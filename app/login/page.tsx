import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { KakaoLoginButton } from "./KakaoLoginButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await getCurrentMember();
  if (user) redirect("/calendar");
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">J4U 찬양팀 라인업</h1>
      <p className="mt-2 text-sm text-stone-600">가능일자를 제출하고 확정된 라인업을 확인하세요.</p>
      {error && <p className="mt-4 text-sm text-red-700">로그인에 실패했어요. 다시 시도해 주세요.</p>}
      <div className="mt-8">
        <KakaoLoginButton />
      </div>
    </div>
  );
}
