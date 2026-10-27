import { sortBySession, type Session } from "@/lib/sessions";
import type { Assignment, LineupEvent, SessionRule } from "@/lib/types";

export type LineupEntry = { memberId: string; name: string; session: Session; satAbsent: boolean };

export function buildLineup(assignments: Assignment[], names: Map<string, string>): LineupEntry[] {
  return sortBySession(assignments).map((a) => ({
    memberId: a.member_id,
    name: names.get(a.member_id) ?? "(탈퇴)",
    session: a.session,
    satAbsent: a.sat_absent,
  }));
}

/** 세션별로 이름을 묶는다: [{session, entries}] (세션 순서 유지) */
export function groupBySession(entries: LineupEntry[]) {
  const groups: { session: Session; entries: LineupEntry[] }[] = [];
  for (const e of entries) {
    const last = groups.at(-1);
    if (last && last.session === e.session) last.entries.push(e);
    else groups.push({ session: e.session, entries: [e] });
  }
  return groups;
}

/** 일정이 캘린더에서 표시될 날짜들: 예배일(없으면 시작일) */
export function serviceDates(event: LineupEvent): string[] {
  const days = (event.event_days ?? []).filter((d) => d.kind === "service").map((d) => d.date);
  return days.length ? days : [event.start_date];
}

export function practiceDates(event: LineupEvent): string[] {
  return (event.event_days ?? []).filter((d) => d.kind === "practice").map((d) => d.date);
}

/** 정원 대비 부족/초과 경고 */
export function capacityWarnings(counts: Partial<Record<Session, number>>, rules: SessionRule[]) {
  const warnings: { session: Session; kind: "short" | "over"; count: number; rule: SessionRule }[] = [];
  for (const rule of rules) {
    const count = counts[rule.session] ?? 0;
    if (count < rule.min) warnings.push({ session: rule.session, kind: "short", count, rule });
    else if (rule.max !== null && count > rule.max) warnings.push({ session: rule.session, kind: "over", count, rule });
  }
  return warnings;
}
