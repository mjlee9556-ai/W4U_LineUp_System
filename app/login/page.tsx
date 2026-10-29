import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { PIN_PATTERN } from "@/lib/pin";
import { PhoneInput } from "@/components/PhoneInput";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  wrong: "전화번호나 PIN이 맞지 않아요.",
  locked: "여러 번 틀려서 10분 동안 잠겼어요. 잠시 후 다시 시도하거나 관리자에게 PIN 초기화를 부탁하세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { member } = await getCurrentMember();
  if (member) redirect("/calendar");
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">J4U 찬양팀 라인업</h1>
      <p className="mt-2 text-sm text-stone-600">가능일자를 제출하고 확정된 라인업을 확인하세요.</p>
      {error && <p className="mt-4 text-sm text-red-700">{ERRORS[error] ?? ERRORS.wrong}</p>}

      <form action={login} className="mt-6 space-y-3">
        <div>
          <label className="label" htmlFor="phone">전화번호 (- 없이 숫자만)</label>
          <PhoneInput />
        </div>
        <div>
          <label className="label" htmlFor="pin">PIN (숫자 4~6자리)</label>
          <input id="pin" name="pin" type="password" inputMode="numeric" required pattern={PIN_PATTERN} autoComplete="current-password" className="input" />
        </div>
        <SubmitButton className="btn-primary w-full py-3" pendingText="확인 중…">로그인</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-stone-600">
        처음이신가요? <Link href="/signup" className="font-medium underline">가입하기</Link>
      </p>
      <p className="mt-2 text-center text-xs text-stone-400">PIN을 잊었다면 관리자에게 초기화를 부탁하세요.</p>
    </div>
  );
}
