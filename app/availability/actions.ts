"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { isSession } from "@/lib/sessions";
import type { AvailabilityStatus } from "@/lib/types";

const STATUSES: AvailabilityStatus[] = ["both", "sun_only", "available", "none"];

export async function saveAvailability(formData: FormData) {
  const { supabase, member } = await requireMember();
  const eventIds = formData.getAll("event_id").map(String);

  const rows = eventIds.flatMap((eventId) => {
    const status = String(formData.get(`status_${eventId}`) ?? "") as AvailabilityStatus;
    if (!STATUSES.includes(status)) return [];
    const sessions = status === "none" ? [] : formData.getAll(`sessions_${eventId}`).map(String).filter(isSession);
    const comment = String(formData.get(`comment_${eventId}`) ?? "").trim().slice(0, 200) || null;
    return [{ member_id: member.id, event_id: eventId, status, sessions, comment, updated_at: new Date().toISOString() }];
  });

  if (rows.length === 0) redirect("/availability?error=empty");

  const { error } = await supabase.from("availabilities").upsert(rows);
  if (error) redirect("/availability?error=save");

  revalidatePath("/availability");
  redirect("/availability?saved=1");
}
