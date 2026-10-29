import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SESSION_LABELS, SIGNUP_SESSIONS } from "@/lib/sessions";
import { PIN_PATTERN } from "@/lib/pin";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { PhoneInput } from "@/components/PhoneInput";
import { SubmitButton } from "@/components/SubmitButton";
import { register } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; code?: string }> }) {
  const { member } = await getCurrentMember();
  if (member) redirect(member.status === "approved" ? "/calendar" : "/pending");
  const { error, code } = await searchParams;
  const inviteCode = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-xl font-bold">팀원 가입</h1>
      <p className="mt-1 text-sm text-stone-600">기본 세션은 매달 가능일자를 낼 때 자동으로 채워져요.</p>
      <div className="mt-6">
        <Notice tone="error" message={error} />
      </div>

      <form action={register} className="space-y-5">
        <div>
          <label className="label" htmlFor="name">이름</label>
          <input id="name" name="name" required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="phone">전화번호 (로그인 아이디, - 없이 숫자만)</label>
          <PhoneInput />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pin">PIN 정하기</label>
            <input id="pin" name="pin" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="숫자 4~6자리" autoComplete="new-password" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="pin_confirm">PIN 확인</label>
            <input id="pin_confirm" name="pin_confirm" type="password" inputMode="numeric" required pattern={PIN_PATTERN} autoComplete="new-password" className="input" />
          </div>
        </div>

        <fieldset>
          <legend className="label">세션 (여러 개 선택 가능)</legend>
          <div className="flex flex-wrap gap-2">
            {SIGNUP_SESSIONS.map((s) => (
              <label key={s}>
                <input type="checkbox" name="sessions" value={s} className="peer sr-only" />
                <span className="chip">{SESSION_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* iOS Safari의 날짜 칸은 최소 너비가 있어 좁은 2칸 배치에서 옆 칸과 겹친다 → 모바일은 한 줄씩 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="label" htmlFor="birth_date">생년월일</label>
            <input id="birth_date" name="birth_date" type="date" required className="input" />
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="email">이메일 (선택)</label>
            <input id="email" name="email" type="email" className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">거주지 (시·구·동까지)</label>
          <input id="address" name="address" required maxLength={40} placeholder="예: 수원시 장안구 조원동" className="input" />
          <p className="mt-1 text-xs text-stone-500">번지나 아파트 이름 같은 상세 주소는 적지 않아요.</p>
        </div>

        <div>
          <label className="label" htmlFor="invite_code">초대코드 (선택)</label>
          <input id="invite_code" name="invite_code" defaultValue={inviteCode} placeholder="없으면 관리자 승인 후 이용" className="input uppercase" autoComplete="off" />
        </div>

        <label className="flex gap-2 rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-stone-700">
          <input type="checkbox" name="privacy" required className="mt-0.5" />
          <span>
            라인업 편성과 연락을 위해 이름, 세션, 생년월일, 전화번호, 이메일(선택), 거주지(시·구·동)를 수집합니다.
            연락처와 생년월일은 본인과 관리자만 볼 수 있고, 다른 팀원에게는 이름과 세션만 보입니다.
            탈퇴하거나 활동을 마치면 삭제합니다. 이에 동의합니다.
          </span>
        </label>

        <SubmitButton className="btn-primary w-full py-3" pendingText="가입 중…">가입하기</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        이미 가입했나요? <Link href="/login" className="font-medium underline">로그인</Link>
      </p>
    </div>
  );
}
