"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSession } from "@/lib/sessions";
import { DISTRICTS, DONG_PATTERN } from "@/lib/regions";

export async function register(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const sessions = formData.getAll("sessions").map(String).filter(isSession);
  const district = get("district");
  const dong = get("dong");

  const fail = (reason: string) => redirect(`/signup?error=${encodeURIComponent(reason)}`);

  if (!get("name")) fail("이름을 입력해 주세요.");
  if (sessions.length === 0) fail("세션을 하나 이상 골라 주세요.");
  if (!(DISTRICTS as readonly string[]).includes(district)) fail("거주 구를 골라 주세요.");
  if (!new RegExp(DONG_PATTERN).test(dong)) fail("동 이름만 입력해 주세요. (예: 서빙고동)");
  if (formData.get("privacy") !== "on") fail("개인정보 수집에 동의해야 가입할 수 있어요.");

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("register_member", {
    p_name: get("name"),
    p_birth_date: get("birth_date") || null,
    p_phone: get("phone"),
    p_email: get("email"),
    p_district: district,
    p_dong: dong,
    p_sessions: sessions,
    p_invite_code: get("invite_code") || null,
  });

  if (error) {
    if (error.message.includes("invalid invite code")) fail("초대코드가 맞지 않거나 만료됐어요. 비워 두면 관리자 승인으로 가입돼요.");
    if (error.message.includes("already registered")) redirect("/calendar");
    fail("가입 중 문제가 생겼어요. 다시 시도해 주세요.");
  }

  redirect(status === "approved" ? "/calendar" : "/pending");
}
