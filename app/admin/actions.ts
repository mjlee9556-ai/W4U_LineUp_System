"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { addDays, isValidMonth, monthStart, weekendSets } from "@/lib/dates";
import { isSession } from "@/lib/sessions";
import type { Availability, EventType, MemberStatus } from "@/lib/types";

export async function setMemberStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("member_id"));
  const status = String(formData.get("status")) as MemberStatus;
  if (!["approved", "inactive", "pending"].includes(status)) return;
  await supabase.from("members").update({ status }).eq("id", id);
  revalidatePath("/admin");
}

function randomCode() {
  // 헷갈리는 글자(0/O, 1/I)는 뺀다
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function createInviteCode(formData: FormData) {
  const { supabase, member } = await requireAdmin();
  const maxUses = Number(formData.get("max_uses")) || null;
  const days = Number(formData.get("expires_days")) || null;
  const expires_at = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  await supabase.from("invite_codes").insert({ code: randomCode(), created_by: member.id, max_uses: maxUses, expires_at });
  revalidatePath("/admin");
}

export async function deleteInviteCode(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("invite_codes").delete().eq("code", String(formData.get("code")));
  revalidatePath("/admin");
}

/** 수집 회차를 열고 그 달 주말 세트(토 연습 + 일 예배)를 만든다 */
export async function createRound(formData: FormData) {
  const { supabase } = await requireAdmin();
  const month = String(formData.get("month"));
  const closesOn = String(formData.get("closes_on") ?? "");
  if (!isValidMonth(month)) redirect("/admin?error=month");

  // 마감일은 그날 자정(한국 시간)까지
  const closes_at = closesOn ? new Date(`${addDays(closesOn, 1)}T00:00:00+09:00`).toISOString() : null;
  const { data: round, error } = await supabase
    .from("availability_rounds")
    .insert({ target_month: monthStart(month), closes_at })
    .select()
    .single();
  if (error || !round) redirect("/admin?error=round");

  for (const set of weekendSets(month)) {
    const { data: event } = await supabase
      .from("events")
      .insert({ round_id: round.id, type: "weekend", title: "주일 예배", start_date: set.saturday, end_date: set.sunday })
      .select()
      .single();
    if (!event) continue;
    await supabase.from("event_days").insert([
      { event_id: event.id, date: set.saturday, kind: "practice" },
      { event_id: event.id, date: set.sunday, kind: "service" },
    ]);
  }

  revalidatePath("/admin");
  redirect(`/admin/rounds/${round.id}`);
}

export async function setRoundStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("round_id"));
  const status = String(formData.get("status")) === "open" ? "open" : "closed";
  await supabase.from("availability_rounds").update({ status }).eq("id", id);
  revalidatePath(`/admin/rounds/${id}`);
}

/** 수련회·특별예배: 월 수집과 별개 일정. 기간의 매일을 섬김일로 만든다 */
export async function createSpecialEvent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const type = String(formData.get("type")) as EventType;
  const title = String(formData.get("title") ?? "").trim();
  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date") || start);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!["retreat", "special"].includes(type) || !title || !start || end < start) redirect("/admin?error=event");

  const { data: event } = await supabase
    .from("events")
    .insert({ type, title, note, start_date: start, end_date: end })
    .select()
    .single();
  if (!event) redirect("/admin?error=event");

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push({ event_id: event.id, date: d, kind: "service" as const });
  await supabase.from("event_days").insert(days);

  revalidatePath("/admin");
  redirect(`/admin/events/${event.id}`);
}

/** 라인업 저장. 체크값은 'session:memberId' */
export async function saveLineup(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  const intent = String(formData.get("intent") ?? "save");

  const picks = formData
    .getAll("assign")
    .map(String)
    .map((v) => v.split(":"))
    .filter(([session, memberId]) => isSession(session) && !!memberId);

  const { data: answers } = await supabase.from("availabilities").select("*").eq("event_id", eventId);
  const sunOnly = new Set(((answers ?? []) as Availability[]).filter((a) => a.status === "sun_only").map((a) => a.member_id));

  await supabase.from("lineup_assignments").delete().eq("event_id", eventId);
  if (picks.length) {
    await supabase.from("lineup_assignments").insert(
      picks.map(([session, memberId]) => ({ event_id: eventId, member_id: memberId, session, sat_absent: sunOnly.has(memberId) })),
    );
  }

  if (intent === "confirm") {
    await supabase.from("events").update({ lineup_status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", eventId);
  }

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/calendar");
  redirect(`/admin/events/${eventId}?saved=${intent}`);
}

export async function unconfirmLineup(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await supabase.from("events").update({ lineup_status: "draft", confirmed_at: null }).eq("id", eventId);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/calendar");
}
