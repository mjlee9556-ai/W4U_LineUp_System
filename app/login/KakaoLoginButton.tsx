"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function KakaoLoginButton() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false);
  }

  return (
    <button
      onClick={signIn}
      disabled={loading}
      className="btn w-full bg-[#FEE500] py-3 text-[#191919] hover:brightness-95"
    >
      {loading ? "카카오로 이동 중…" : "카카오로 시작하기"}
    </button>
  );
}
