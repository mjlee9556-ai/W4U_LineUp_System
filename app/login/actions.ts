"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { normalizePhone, verifyPin } from "@/lib/pin";

const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

export async function login(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const pin = String(formData.get("pin") ?? "");

  const member = await queryOne<{ id: string; pin_hash: string; locked: boolean }>(
    `select id, pin_hash, coalesce(locked_until > now(), false) as locked from members where phone = $1`,
    [phone],
  );
  if (!member) redirect("/login?error=wrong");
  if (member.locked) redirect("/login?error=locked");

  if (!verifyPin(pin, member.pin_hash)) {
    // 5번 틀리면 10분 잠금
    const [after] = await query<{ locked: boolean }>(
      `update members set
         locked_until = case when failed_logins + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end,
         failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end
       where id = $1
       returning coalesce(locked_until > now(), false) as locked`,
      [member.id, MAX_FAILS, LOCK_MINUTES],
    );
    redirect(after?.locked ? "/login?error=locked" : "/login?error=wrong");
  }

  await query(`update members set failed_logins = 0, locked_until = null where id = $1`, [member.id]);
  await startSession(member.id);
  redirect("/calendar");
}
