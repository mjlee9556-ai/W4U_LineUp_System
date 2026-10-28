import { sortBySession, type Session } from "@/lib/sessions";
import type { Assignment, Guest, LineupEvent } from "@/lib/types";

/** key는 팀원이면 member id, 게스트면 guest:<id> */
export type LineupEntry = { key: string; memberId: string | null; name: string; session: Session; satAbsent: boolean; guest: boolean };

export function buildLineup(assignments: Assignment[], names: Map<string, string>, guests: Guest[] = []): LineupEntry[] {
  const entries: LineupEntry[] = [
    ...assignments.map((a) => ({
      key: a.member_id,
      memberId: a.member_id,
      name: names.get(a.member_id) ?? "(탈퇴)",
      session: a.session,
      satAbsent: a.sat_absent,
      guest: false,
    })),
    // 게스트는 같은 세션 안에서 팀원 뒤에 온다
    ...guests.map((g) => ({ key: `guest:${g.id}`, memberId: null, name: g.name, session: g.session, satAbsent: false, guest: true })),
  ];
  return sortBySession(entries);
}

/** "홍길동, 김철수" 같은 입력을 게스트 이름 목록으로 (중복·빈칸 제거, 20자 제한) */
export function parseGuestNames(input: string): string[] {
  const names = input
    .split(/[,，\n]/)
    .map((n) => n.trim().replace(/\s+/g, " ").slice(0, 20))
    .filter(Boolean);
  return [...new Set(names)];
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

