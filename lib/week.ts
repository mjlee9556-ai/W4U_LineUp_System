import "server-only";
import { isAdmin } from "@/lib/types";
import { query } from "@/lib/db";
import { addDays, monthStart, parseISODate, shiftMonth, todayKST, weekOfMonthLabel } from "@/lib/dates";
import { buildLineup, practiceDates, serviceDates, type LineupEntry } from "@/lib/lineup";
import { getEventsBetween, getMemberNames, withDays } from "@/lib/queries";
import { REQUIRED_SESSIONS, type Part, type Session } from "@/lib/sessions";
import type { Assignment, Guest, LineupEvent, Member } from "@/lib/types";

/** 일정의 대표 날짜(마지막 예배일) */
export function mainDate(event: LineupEvent): string {
  return serviceDates(event).at(-1) ?? event.end_date;
}

/**
 * 라인업·콘티 화면에서 고를 수 있는 일정: 지난 5주 ~ 앞으로 10주.
 * 팀원은 확정된 일정만, 관리자는 편성 중인 일정도 본다.
 */
export async function getSelectableEvents(member: Pick<Member, "role">): Promise<LineupEvent[]> {
  const today = todayKST();
  const events = await query<LineupEvent>(
    `select * from events
      where end_date >= $1 and start_date <= $2 ${isAdmin(member) ? "" : "and lineup_status = 'confirmed'"}
      order by start_date`,
    [addDays(today, -35), addDays(today, 70)],
  );
  return withDays(events);
}

/** 기본으로 보여 줄 일정: 아직 지나지 않은 첫 일정, 없으면 가장 최근 일정 */
export function pickCurrent(events: LineupEvent[], today = todayKST()): LineupEvent | undefined {
  return events.find((e) => mainDate(e) >= today) ?? events.at(-1);
}

export async function getLineup(eventId: string): Promise<LineupEntry[]> {
  const [assignments, guests] = await Promise.all([
    query<Assignment>(`select * from lineup_assignments where event_id = $1`, [eventId]),
    query<Guest>(`select * from lineup_guests where event_id = $1 order by name`, [eventId]),
  ]);
  const names = await getMemberNames(assignments.map((a) => a.member_id));
  return buildLineup(assignments, names, guests);
}

/** 주차 고르기 목록에 쓰는 이름: '2026년 12월 2주차 (12/13)' */
export function eventLabel(event: LineupEvent): string {
  const date = mainDate(event);
  const d = parseISODate(date);
  const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const name = event.type === "weekend" ? weekOfMonthLabel(date) : `${d.getUTCMonth() + 1}월 ${event.title}`;
  return `${d.getUTCFullYear()}년 ${name} (${md})${event.lineup_status === "draft" ? " · 편성 중" : ""}`;
}


/**
 * 한 달의 주차별 라인업 현황 (라인업 탭 월 캘린더용).
 * 팀원은 확정된 일정만, 관리자는 편성 중인 일정도 본다.
 */
export async function getMonthWeeks(month: string, member: Pick<Member, "role">) {
  const from = monthStart(month);
  const to = addDays(monthStart(shiftMonth(month, 1)), -1);
  const events = (await getEventsBetween(from, to)).filter(
    (e) => mainDate(e).startsWith(month) && (isAdmin(member) || e.lineup_status === "confirmed"),
  );
  const ids = events.map((e) => e.id);
  const [assigned, guests] = ids.length
    ? await Promise.all([
        query<{ event_id: string; member_id: string; session: Session }>(
          `select event_id, member_id, session from lineup_assignments where event_id = any($1::uuid[])`,
          [ids],
        ),
        query<{ event_id: string; session: Session }>(`select event_id, session from lineup_guests where event_id = any($1::uuid[])`, [ids]),
      ])
    : [[], []];
  const weeks = events.map((e) => {
    const sessions = new Set([...assigned, ...guests].filter((a) => a.event_id === e.id).map((a) => a.session));
    return {
      id: e.id,
      date: mainDate(e),
      practiceDates: practiceDates(e),
      confirmed: e.lineup_status === "confirmed",
      filled: REQUIRED_SESSIONS.filter((s) => sessions.has(s)).length,
      required: REQUIRED_SESSIONS.length,
      people: new Set(assigned.filter((a) => a.event_id === e.id).map((a) => a.member_id)).size + guests.filter((g) => g.event_id === e.id).length,
    };
  });
  return { events, weeks };
}

export type PartSave = { event_id: string; part: Part; saved_by_name: string | null; method: "manual" | "auto"; saved_at: string };

/** 파트별 마지막 저장 기록 (누가·언제·자동/수동) */
export async function getPartSaves(eventIds: string[]): Promise<PartSave[]> {
  if (!eventIds.length) return [];
  return query<PartSave>(
    `select p.event_id, p.part, m.name as saved_by_name, p.method, p.saved_at
       from lineup_part_saves p left join members m on m.id = p.saved_by
      where p.event_id = any($1::uuid[])`,
    [eventIds],
  );
}
