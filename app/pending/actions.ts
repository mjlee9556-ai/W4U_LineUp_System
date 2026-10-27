"use server";

import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { transaction } from "@/lib/db";

export async function redeemInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const { member } = await getCurrentMember();
  if (!member) redirect("/login");
  if (member.status !== "pending") redirect("/calendar");

  const ok = await transaction(async (tx) => {
    const used = await tx.query(
      `update invite_codes set used_count = used_count + 1
        where code = $1 and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses)
        returning code`,
      [code],
    );
    if (!used.rows.length) return false;
    await tx.query(`update members set status = 'approved' where id = $1`, [member.id]);
    return true;
  });
  redirect(ok ? "/calendar" : "/pending?error=code");
}
