import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/sessions";
import type { Member } from "@/lib/types";

/** 로그인 사용자와 팀원 정보. 가입 전이면 member가 null */
export async function getCurrentMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, member: null, sessions: [] as Session[] };

  const [{ data: member }, { data: sessionRows }] = await Promise.all([
    supabase.from("members").select("*").eq("id", user.id).maybeSingle<Member>(),
    supabase.from("member_sessions").select("session").eq("member_id", user.id),
  ]);

  return {
    supabase,
    user,
    member,
    sessions: (sessionRows ?? []).map((r) => r.session as Session),
  };
}

/** 승인된 팀원만 통과. 아니면 알맞은 화면으로 보낸다 */
export async function requireMember() {
  const ctx = await getCurrentMember();
  if (!ctx.user) redirect("/login");
  if (!ctx.member) redirect("/signup");
  if (ctx.member.status !== "approved") redirect("/pending");
  return { ...ctx, user: ctx.user, member: ctx.member };
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.member.role !== "admin") redirect("/");
  return ctx;
}
