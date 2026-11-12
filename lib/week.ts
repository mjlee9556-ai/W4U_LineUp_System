import "server-only";
import { query } from "@/lib/db";
import { addDays, parseISODate, todayKST, weekOfMonthLabel } from "@/lib/dates";
import { buildLineup, serviceDates, type LineupEntry } from "@/lib/lineup";
import { getMemberNames, withDays } from "@/lib/queries";
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
      where end_date >= $1 and start_date <= $2 ${member.role === "admin" ? "" : "and lineup_status = 'confirmed'"}
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

