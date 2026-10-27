import "server-only";
import { query } from "@/lib/db";
import { todayKST } from "@/lib/dates";
import type { EventDay, LineupEvent, Round } from "@/lib/types";

/** 일정마다 event_days를 붙인다 (날짜순) */
export async function withDays(events: LineupEvent[]): Promise<LineupEvent[]> {
  if (events.length === 0) return events;
  const days = await query<EventDay>(
    `select id, event_id, date, kind, start_time::text as start_time from event_days where event_id = any($1::uuid[]) order by date`,
    [events.map((e) => e.id)],
  );
  for (const e of events) e.event_days = days.filter((d) => d.event_id === e.id);
  return events;
}

/** 응답을 받을 수 있는 일정인지 판단하는 SQL 조건 (events e, availability_rounds r 기준) */
export const ACCEPTING_RESPONSES = `
  e.lineup_status = 'draft'
  and (
    (e.round_id is null and e.end_date >= $TODAY)
    or (r.status = 'open' and (r.closes_at is null or r.closes_at > now()))
  )`;

/** 지금 응답을 받는 일정: 열린 회차의 주말 세트 + 아직 지나지 않은 비주말 일정 */
export async function getOpenEvents() {
  const today = todayKST();
  const rounds = await query<Round>(
    `select * from availability_rounds where status = 'open' and (closes_at is null or closes_at > now()) order by target_month`,
  );
  const events = await query<LineupEvent>(
    `select e.* from events e left join availability_rounds r on r.id = e.round_id
      where ${ACCEPTING_RESPONSES.replace("$TODAY", "$1")}
      order by e.start_date`,
    [today],
  );
  return { rounds, events: await withDays(events) };
}

/** 기간과 겹치는 일정 (캘린더용) */
export async function getEventsBetween(from: string, to: string) {
  const events = await query<LineupEvent>(
    `select * from events where start_date <= $2 and end_date >= $1 order by start_date`,
    [from, to],
  );
  return withDays(events);
}

/** 이름만 조회 (다른 팀원에게 연락처는 보여주지 않는다) */
export async function getMemberNames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const rows = await query<{ id: string; name: string }>(`select id, name from members where id = any($1::uuid[])`, [unique]);
  return new Map(rows.map((m) => [m.id, m.name]));
}
