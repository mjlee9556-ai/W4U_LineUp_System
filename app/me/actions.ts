"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";

export async function changePin(formData: FormData) {
  const { member } = await requireMember();
  const current = String(formData.get("current_pin") ?? "");
  const next = String(formData.get("new_pin") ?? "");

  const row = await queryOne<{ pin_hash: string }>(`select pin_hash from members where id = $1`, [member.id]);
  if (!row || !verifyPin(current, row.pin_hash)) redirect("/me?error=current");
  if (!isValidPin(next) || next !== String(formData.get("new_pin_confirm") ?? "")) redirect("/me?error=new");

  await query(`update members set pin_hash = $2 where id = $1`, [member.id, hashPin(next)]);
  redirect("/me?saved=1");
}
