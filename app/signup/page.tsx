import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SESSION_LABELS, SIGNUP_SESSIONS } from "@/lib/sessions";
import { DISTRICTS, DONG_PATTERN } from "@/lib/regions";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { register } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, member } = await getCurrentMember();
  if (!user) redirect("/login");
  if (member) redirect(member.status === "approved" ? "/calendar" : "/pending");
  const { error } = await searchParams;

  const meta = user.user_metadata ?? {};
  const defaultName = String(meta.name ?? meta.full_name ?? meta.preferred_username ?? "");

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
          <input id="name" name="name" required defaultValue={defaultName} className="input" />
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="birth_date">생년월일</label>
            <input id="birth_date" name="birth_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">전화번호</label>
            <input id="phone" name="phone" type="tel" required placeholder="010-0000-0000" pattern="01[0-9]-?[0-9]{3,4}-?[0-9]{4}" className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">이메일</label>
          <input id="email" name="email" type="email" required defaultValue={user.email ?? ""} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="district">거주 구</label>
            <select id="district" name="district" required defaultValue="" className="input">
              <option value="" disabled>선택</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dong">동</label>
            <input id="dong" name="dong" required placeholder="예: 서빙고동" pattern={DONG_PATTERN} maxLength={11} className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="invite_code">초대코드 (선택)</label>
          <input id="invite_code" name="invite_code" placeholder="없으면 관리자 승인 후 이용" className="input uppercase" autoComplete="off" />
        </div>

        <label className="flex gap-2 rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-stone-700">
          <input type="checkbox" name="privacy" required className="mt-0.5" />
          <span>
            라인업 편성과 연락을 위해 이름, 세션, 생년월일, 전화번호, 이메일, 거주지(구·동)를 수집합니다.
            연락처와 생년월일은 본인과 관리자만 볼 수 있고, 다른 팀원에게는 이름과 세션만 보입니다.
            탈퇴하거나 활동을 마치면 삭제합니다. 이에 동의합니다.
          </span>
        </label>

        <SubmitButton className="btn-primary w-full py-3" pendingText="가입 중…">가입하기</SubmitButton>
      </form>
    </div>
  );
}
