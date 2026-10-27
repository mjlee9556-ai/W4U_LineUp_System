import type { SupabaseClient } from "@supabase/supabase-js";
import { todayKST } from "@/lib/dates";
import type { LineupEvent, Round } from "@/lib/types";

const EVENT_SELECT = "*, event_days(*)";

function sortDays(events: LineupEvent[]): LineupEvent[] {
  for (const e of events) e.event_days?.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

/** 지금 응답을 받는 일정: 열린 회차의 주말 세트 + 아직 지나지 않은 비주말 일정 */
export async function getOpenEvents(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const { data: rounds } = await supabase
    .from("availability_rounds")
    .select("*")
    .eq("status", "open")
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order("target_month");

  const roundIds = (rounds ?? []).map((r: Round) => r.id);
  const [{ data: roundEvents }, { data: specialEvents }] = await Promise.all([
    roundIds.length
      ? supabase.from("events").select(EVENT_SELECT).in("round_id", roundIds).eq("lineup_status", "draft")
      : Promise.resolve({ data: [] }),
    supabase
      .from("events")
      .select(EVENT_SELECT)
      .is("round_id", null)
      .eq("lineup_status", "draft")
      .gte("end_date", todayKST()),
  ]);

  const events = sortDays([...(roundEvents ?? []), ...(specialEvents ?? [])] as LineupEvent[]).sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  );
  return { rounds: (rounds ?? []) as Round[], events };
}

/** 기간과 겹치는 일정 (캘린더용) */
export async function getEventsBetween(supabase: SupabaseClient, from: string, to: string) {
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date");
  return sortDays((data ?? []) as LineupEvent[]);
}

/** member_directory 뷰로 이름만 조회 */
export async function getMemberNames(supabase: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("member_directory").select("id, name").in("id", unique);
  return new Map((data ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));
}
