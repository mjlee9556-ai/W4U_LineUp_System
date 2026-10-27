"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function redeemInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error || !data) redirect("/pending?error=code");
  redirect("/calendar");
}
