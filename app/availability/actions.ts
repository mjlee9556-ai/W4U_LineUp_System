"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { todayKST } from "@/lib/dates";
import { ACCEPTING_RESPONSES } from "@/lib/queries";
import { isSession } from "@/lib/sessions";
import type { AvailabilityStatus } from "@/lib/types";

const STATUSES: AvailabilityStatus[] = ["both", "sun_only", "available", "none"];

export async function saveAvailability(formData: FormData) {
  const { member } = await requireMember();
  const eventIds = formData.getAll("event_id").map(String);

  const rows = eventIds.flatMap((eventId) => {
    const status = String(formData.get(`status_${eventId}`) ?? "") as AvailabilityStatus;
    if (!STATUSES.includes(status)) return [];
    const sessions = status === "none" ? [] : formData.getAll(`sessions_${eventId}`).map(String).filter(isSession);
    const comment = String(formData.get(`comment_${eventId}`) ?? "").trim().slice(0, 200) || null;
    return [{ eventId, status, sessions, comment }];
  });
  if (rows.length === 0) redirect("/availability?error=empty");

  // 마감됐거나 확정된 일정은 저장하지 않는다
  const open = new Set(
    (
      await query<{ id: string }>(
        `select e.id from events e left join availability_rounds r on r.id = e.round_id
          where e.id = any($1::uuid[]) and ${ACCEPTING_RESPONSES.replace("$TODAY", "$2")}`,
        [rows.map((r) => r.eventId), todayKST()],
      )
    ).map((r) => r.id),
  );
  if (rows.some((r) => !open.has(r.eventId))) redirect("/availability?error=save");

  await transaction(async (tx) => {
    for (const r of rows) {
      await tx.query(
        `insert into availabilities (member_id, event_id, status, sessions, comment, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (member_id, event_id) do update
           set status = excluded.status, sessions = excluded.sessions, comment = excluded.comment, updated_at = now()`,
        [member.id, r.eventId, r.status, r.sessions, r.comment],
      );
    }
  });

  revalidatePath("/availability");
  redirect("/availability?saved=1");
}
