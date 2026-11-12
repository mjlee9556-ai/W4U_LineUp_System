import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { daysUntil, formatMonth, formatShort, todayKST } from "@/lib/dates";
import { serviceDates } from "@/lib/lineup";
import { withDays } from "@/lib/queries";
import type { LineupEvent, Round } from "@/lib/types";
import { PhoneInput } from "@/components/PhoneInput";
import { PinBoxes } from "@/components/PinBoxes";
import { SubmitButton } from "@/components/SubmitButton";
import { ArrowRightIcon, CalendarIcon, ChurchIcon, InfoIcon, LockIcon, UserIcon, UsersIcon } from "@/components/icons";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  wrong: "전화번호나 PIN이 맞지 않아요.",
  locked: "여러 번 틀려서 10분 동안 잠겼어요. 잠시 후 다시 시도하거나 관리자에게 PIN 초기화를 부탁하세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { member } = await getCurrentMember();
  if (member) redirect("/calendar");
  const { error } = await searchParams;

  const today = todayKST();
  const [rounds, upcoming] = await Promise.all([
    query<Round>(`select * from availability_rounds where status = 'open' and (closes_at is null or closes_at > now()) order by target_month limit 1`),
    query<LineupEvent>(`select * from events where end_date >= $1 order by start_date limit 3`, [today]).then(withDays),
  ]);
  const next = upcoming
    .map((e) => ({ event: e, date: serviceDates(e).find((d) => d >= today) }))
    .find((x): x is { event: LineupEvent; date: string } => !!x.date);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3.5 py-1.5 text-[12px] font-extrabold tracking-wide text-navy-900">
          <ChurchIcon size={17} />
          J4U WORSHIP
        </span>
      </div>

      {rounds[0] && (
        <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-accent-300/70 bg-accent-50 px-3 py-1 text-xs font-bold text-accent-600">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
          {formatMonth(rounds[0].target_month.slice(0, 7))} 가능일자 받는 중
        </span>
      )}
      <h1 className={`${rounds[0] ? "mt-3" : "mt-8"} text-[28px] font-extrabold tracking-tight text-stone-900`}>J4U 찬양팀 라인업</h1>
      <p className="mt-1.5 text-sm text-stone-600">가능일자를 제출하고 확정된 라인업과 콘티를 확인하세요.</p>

      <form action={login} className="panel mt-6 space-y-5 p-5">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ERRORS[error] ?? ERRORS.wrong}</p>}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="phone" className="flex items-center gap-1.5 text-[13px] font-bold text-stone-800">
              <UserIcon size={16} />
              사역자 확인 (전화번호)
            </label>
            <span className="text-xs font-semibold text-stone-500">- 없이 숫자만</span>
          </div>
          <PhoneInput className="field" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="pin" className="flex items-center gap-1.5 text-[13px] font-bold text-stone-800">
              <LockIcon size={16} />
              팀원 인증 PIN (4~6자리)
            </label>
            <span className="text-xs font-semibold text-accent-600">잊었다면 관리자에게</span>
          </div>
          <PinBoxes />
          <p className="mt-2 flex items-start gap-1 text-xs text-stone-500">
            <InfoIcon size={14} className="mt-px shrink-0" />
            가입할 때 정한 숫자 PIN이에요. 5번 틀리면 10분 동안 잠겨요.
          </p>
        </div>

        <SubmitButton
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-base font-bold text-white shadow-sm transition hover:bg-navy-800 disabled:opacity-60"
          pendingText="확인 중…"
        >
          로그인하기 <ArrowRightIcon size={20} />
        </SubmitButton>

        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          또는
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <Link
          href="/signup"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-800 hover:bg-stone-50"
        >
          <UsersIcon size={18} className="text-accent-600" />
          처음이신가요? 찬양팀 사역 합류 신청
        </Link>
      </form>

      {next && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100/70 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-accent-600 shadow-sm">
            <CalendarIcon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-stone-900">
              다음 예배 · {next.event.type === "weekend" ? "주일 예배" : next.event.title}
            </p>
            <p className="text-[13px] text-stone-500">{formatShort(next.date)}</p>
          </div>
          <span className="text-sm font-extrabold text-accent-600">
            {daysUntil(next.date) === 0 ? "D-day" : `D-${daysUntil(next.date)}`}
          </span>
        </div>
      )}

      <footer className="mt-auto border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        © J4U Worship Ministry · 문의는 찬양팀 관리자에게
      </footer>
    </div>
  );
}
