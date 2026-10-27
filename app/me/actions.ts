"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";
import { isSession } from "@/lib/sessions";

export async function changePin(formData: FormData) {
  const { member } = await requireMember();
  const current = String(formData.get("current_pin") ?? "");
  const next = String(formData.get("new_pin") ?? "");

  const row = await queryOne<{ pin_hash: string }>(`select pin_hash from members where id = $1`, [member.id]);
  if (!row || !verifyPin(current, row.pin_hash)) redirect("/me?error=current");
  if (!isValidPin(next) || next !== String(formData.get("new_pin_confirm") ?? "")) redirect("/me?error=new");

  await query(`update members set pin_hash = $2 where id = $1`, [member.id, hashPin(next)]);
  redirect("/me?saved=pin");
}

export async function updateProfile(formData: FormData) {
  const { member } = await requireMember();
  const address = String(formData.get("address") ?? "").trim().replace(/\s+/g, " ");
  // 서브 인도자는 관리자가 배정할 때만 쓰므로 여기서는 고르지 않는다
  const sessions = formData.getAll("sessions").map(String).filter(isSession).filter((s) => s !== "sub_leader");

  if (!address || address.length > 40) redirect("/me?error=address");
  if (sessions.length === 0) redirect("/me?error=sessions");

  await transaction(async (tx) => {
    await tx.query(`update members set district = $2, dong = null where id = $1`, [member.id, address]);
    await tx.query(`delete from member_sessions where member_id = $1 and session <> 'sub_leader'`, [member.id]);
    for (const s of sessions) {
      await tx.query(`insert into member_sessions (member_id, session) values ($1, $2) on conflict do nothing`, [member.id, s]);
    }
  });
  redirect("/me?saved=profile");
}
