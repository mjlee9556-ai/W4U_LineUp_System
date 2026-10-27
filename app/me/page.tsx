import { requireMember } from "@/lib/auth";
import { formatPhone, PIN_PATTERN } from "@/lib/pin";
import { SESSION_LABELS } from "@/lib/sessions";
import { formatAddress } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { changePin } from "./actions";

const ERRORS: Record<string, string> = {
  current: "지금 PIN이 맞지 않아요.",
  new: "새 PIN은 숫자 4~6자리로, 확인과 똑같이 입력해 주세요.",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { member, sessions } = await requireMember();
  const { saved, error } = await searchParams;

  return (
    <AppShell member={member}>
      <h1 className="text-xl font-bold">내 정보</h1>
      <section className="card mt-4 text-sm">
        <div className="font-medium">{member.name}</div>
        <div className="mt-1 text-stone-600">{formatPhone(member.phone)} · {formatAddress(member)}</div>
        <div className="mt-1 text-stone-600">기본 세션: {sessions.map((s) => SESSION_LABELS[s]).join(", ")}</div>
      </section>

      <section className="card mt-4">
        <h2 className="font-semibold">PIN 바꾸기</h2>
        <div className="mt-3">
          <Notice message={saved ? "PIN을 바꿨어요." : undefined} />
          <Notice tone="error" message={error ? ERRORS[error] : undefined} />
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
