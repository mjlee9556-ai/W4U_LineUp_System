import type { Session } from "@/lib/sessions";

export type AutoAssignInput = {
  /** 배정할 주(일정)들. 날짜순 */
  events: { id: string }[];
  /** 세션 순서대로 처리한다. 인원이 0이면 건너뛴다 */
  sessions: { session: Session; count: number }[];
  /** event id → 그 주에 해당 세션으로 가능한 사람들 */
  candidates: (eventId: string, session: Session) => string[];
  /** 이미 확정돼 바꾸지 않는 배정. 공평하게 나눌 때 횟수에 포함한다 */
  fixed?: { eventId: string; memberId: string; session: Session }[];
};

export type AutoAssignment = { eventId: string; memberId: string; session: Session };

/**
 * 파트(세션)마다 가능한 주만 후보로 삼아, 한 달 섬김 횟수가 고르게 되도록 배정한다.
 *
 * - 후보가 적은 주부터 채운다 (그 주를 맡을 수 있는 사람이 적을수록 먼저)
 * - 한 사람을 같은 주에 두 세션으로 넣지 않는다 (필요하면 관리자가 직접)
 * - 같은 세션에서 지금까지 덜 섬긴 사람을 먼저 고른다
 * - 그다음은 전체 섬김이 적은 사람, 가능한 주가 적은 사람(기회가 적은 사람) 순
 *
 * 예: 베이스 A(1,2,4,5주) B(3,5주) → A 1·2·4주, B 3·5주
 */
export function autoAssign({ events, sessions, candidates, fixed = [] }: AutoAssignInput): AutoAssignment[] {
  const result: AutoAssignment[] = [];
  const total = new Map<string, number>();
  const busy = new Set<string>(); // `${eventId}:${memberId}`
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const f of fixed) {
    bump(total, f.memberId);
    busy.add(`${f.eventId}:${f.memberId}`);
  }

  for (const { session, count } of sessions) {
    if (count <= 0) continue;
    const perSession = new Map<string, number>();
    for (const f of fixed) if (f.session === session) bump(perSession, f.memberId);

    const pool = new Map(events.map((e) => [e.id, candidates(e.id, session)]));
    const weeksAvailable = new Map<string, number>();
    for (const ids of pool.values()) for (const id of ids) bump(weeksAvailable, id);

    // 후보가 적은 주부터. 같으면 날짜순
    const order = events
      .map((e, i) => ({ id: e.id, i, n: pool.get(e.id)!.length }))
      .sort((a, b) => a.n - b.n || a.i - b.i);

    for (const { id: eventId } of order) {
      for (let slot = 0; slot < count; slot++) {
        const pick = pool
          .get(eventId)!
          .filter((m) => !busy.has(`${eventId}:${m}`))
          .sort(
            (a, b) =>
              (perSession.get(a) ?? 0) - (perSession.get(b) ?? 0) ||
              (total.get(a) ?? 0) - (total.get(b) ?? 0) ||
              (weeksAvailable.get(a) ?? 0) - (weeksAvailable.get(b) ?? 0) ||
              a.localeCompare(b),
          )[0];
        if (!pick) break;
        bump(perSession, pick);
        bump(total, pick);
        busy.add(`${eventId}:${pick}`);
        result.push({ eventId, memberId: pick, session });
      }
    }
  }
  return result;
}

/** 배정 목록 → 세션별·사람별 섬김 횟수 */
export function countBySession(rows: { session: Session; memberId: string }[]) {
  const counts = new Map<Session, Map<string, number>>();
  for (const r of rows) {
    const m = counts.get(r.session) ?? new Map<string, number>();
    m.set(r.memberId, (m.get(r.memberId) ?? 0) + 1);
    counts.set(r.session, m);
  }
  return counts;
}
