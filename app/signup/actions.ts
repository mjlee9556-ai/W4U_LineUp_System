"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { hashPin, isValidPhone, isValidPin, normalizePhone } from "@/lib/pin";
import { isSession } from "@/lib/sessions";
import type { MemberStatus } from "@/lib/types";

class SignupError extends Error {}

export async function register(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const sessions = formData.getAll("sessions").map(String).filter(isSession).filter((s) => s !== "sub_leader");
  const phone = normalizePhone(get("phone"));
  const pin = get("pin");
  const address = get("address").replace(/\s+/g, " ");
  const inviteCode = get("invite_code").toUpperCase();

  const fail = (reason: string) => redirect(`/signup?error=${encodeURIComponent(reason)}`);

  if (!get("name")) fail("이름을 입력해 주세요.");
  if (!isValidPhone(phone)) fail("전화번호를 다시 확인해 주세요.");
  if (!isValidPin(pin)) fail("PIN은 숫자 4~6자리로 정해 주세요.");
  if (pin !== get("pin_confirm")) fail("PIN 확인이 맞지 않아요.");
  if (sessions.length === 0) fail("세션을 하나 이상 골라 주세요.");
  if (!address || address.length > 40) fail("거주지를 시·구·동까지만 입력해 주세요. (예: 수원시 장안구 조원동)");
  if (formData.get("privacy") !== "on") fail("개인정보 수집에 동의해야 가입할 수 있어요.");

  let memberId: string;
  let status: MemberStatus;
  try {
    ({ memberId, status } = await transaction(async (tx) => {
      if ((await tx.query(`select 1 from members where phone = $1`, [phone])).rows.length) {
        throw new SignupError("이미 가입된 전화번호예요. 로그인해 주세요.");
      }

      // 맨 처음 가입하는 사람은 관리자가 된다
      const isFirst = (await tx.query(`select 1 from members limit 1`)).rows.length === 0;
      let status: MemberStatus = isFirst ? "approved" : "pending";

      if (!isFirst && inviteCode) {
        const used = await tx.query(
          `update invite_codes set used_count = used_count + 1
            where code = $1 and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses)
            returning code`,
          [inviteCode],
        );
        if (!used.rows.length) throw new SignupError("초대코드가 맞지 않거나 만료됐어요. 비워 두면 관리자 승인으로 가입돼요.");
        status = "approved";
      }

      const { rows } = await tx.query<{ id: string }>(
        `insert into members (name, phone, pin_hash, birth_date, email, district, dong, role, status, privacy_agreed_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) returning id`,
        [get("name"), phone, hashPin(pin), get("birth_date") || null, get("email") || null, address, null, isFirst ? "admin" : "member", status],
      );
      for (const s of sessions) {
        await tx.query(`insert into member_sessions (member_id, session) values ($1, $2) on conflict do nothing`, [rows[0].id, s]);
      }
      return { memberId: rows[0].id, status };
    }));
  } catch (e) {
    if (e instanceof SignupError) fail(e.message);
    throw e;
  }

  await startSession(memberId!);
  redirect(status! === "approved" ? "/calendar" : "/pending");
}
