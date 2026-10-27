import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { redeemInvite } from "./actions";

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { member } = await getCurrentMember();
  if (!member) redirect("/login");
  if (member.status === "approved") redirect("/calendar");
  const { error } = await searchParams;

  if (member.status === "inactive") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
        <h1 className="text-xl font-bold">비활성화된 계정이에요</h1>
        <p className="mt-2 text-sm text-stone-600">다시 활동하려면 관리자에게 문의해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold">가입 승인을 기다리고 있어요</h1>
      <p className="mt-2 text-sm text-stone-600">
        {member.name}님, 관리자가 승인하면 가능일자를 제출할 수 있어요. 초대코드를 받았다면 아래에 입력하면 바로 승인돼요.
      </p>
      <form action={redeemInvite} className="mt-6 flex gap-2">
        <input name="code" required placeholder="초대코드" className="input uppercase" autoComplete="off" />
        <SubmitButton pendingText="확인 중…">확인</SubmitButton>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">코드가 맞지 않거나 만료됐어요.</p>}
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="btn-secondary w-full">로그아웃</button>
      </form>
    </div>
  );
}
