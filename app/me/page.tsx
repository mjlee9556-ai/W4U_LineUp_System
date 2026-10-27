import { requireMember } from "@/lib/auth";
import { formatPhone, PIN_PATTERN } from "@/lib/pin";
import { SESSION_LABELS, SIGNUP_SESSIONS } from "@/lib/sessions";
import { formatAddress } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { changePin, updateProfile } from "./actions";

const SAVED: Record<string, string> = {
  pin: "PIN을 바꿨어요.",
  profile: "내 정보를 저장했어요.",
};

const ERRORS: Record<string, string> = {
  current: "지금 PIN이 맞지 않아요.",
  new: "새 PIN은 숫자 4~6자리로, 확인과 똑같이 입력해 주세요.",
  address: "거주지를 시·구·동까지만 입력해 주세요. (예: 수원시 장안구 조원동)",
  sessions: "세션을 하나 이상 골라 주세요.",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { member, sessions } = await requireMember();
  const { saved, error } = await searchParams;
  const pinError = error === "current" || error === "new";

  return (
    <AppShell member={member}>
      <h1 className="text-xl font-bold">내 정보</h1>

      <section className="card mt-4">
        <div className="font-medium">{member.name}</div>
        <div className="mt-1 text-sm text-stone-600">{formatPhone(member.phone)}</div>
        <div className="mt-3">
          <Notice message={saved === "profile" ? SAVED.profile : undefined} />
          <Notice tone="error" message={error && !pinError ? ERRORS[error] : undefined} />
        </div>
        <form action={updateProfile} className="space-y-4">
          <div>
            <label className="label" htmlFor="address">거주지</label>
            <input
              id="address"
              name="address"
              required
              maxLength={40}
              defaultValue={formatAddress(member)}
              placeholder="예: 수원시 장안구 조원동"
              className="input"
            />
          </div>
          <fieldset>
            <legend className="label">기본 세션 (여러 개 고를 수 있어요)</legend>
            <div className="flex flex-wrap gap-2">
              {SIGNUP_SESSIONS.map((s) => (
                <label key={s}>
                  <input type="checkbox" name="sessions" value={s} defaultChecked={sessions.includes(s)} className="peer sr-only" />
                  <span className="chip">{SESSION_LABELS[s]}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">가능일자를 낼 때 기본으로 채워지는 세션이에요. 이미 낸 응답은 바뀌지 않아요.</p>
          </fieldset>
          <SubmitButton>저장</SubmitButton>
        </form>
      </section>

      <section className="card mt-4">
        <h2 className="font-semibold">PIN 바꾸기</h2>
        <div className="mt-3">
          <Notice message={saved === "pin" ? SAVED.pin : undefined} />
          <Notice tone="error" message={pinError ? ERRORS[error] : undefined} />
        </div>
        <form action={changePin} className="grid gap-2 sm:grid-cols-3">
          <input name="current_pin" type="password" inputMode="numeric" required placeholder="지금 PIN" autoComplete="current-password" className="input" />
          <input name="new_pin" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="새 PIN (4~6자리)" autoComplete="new-password" className="input" />
          <input name="new_pin_confirm" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="새 PIN 확인" autoComplete="new-password" className="input" />
          <SubmitButton className="btn-primary sm:col-span-3">바꾸기</SubmitButton>
        </form>
      </section>
    </AppShell>
  );
}
