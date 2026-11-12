import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { daysUntil, formatMonthDay, formatShort, todayKST, weekdayLabel } from "@/lib/dates";
import { practiceDates } from "@/lib/lineup";
import { formatPhone, PIN_PATTERN } from "@/lib/pin";
import { withDays } from "@/lib/queries";
import { SESSION_LABELS, SIGNUP_SESSIONS, type Session } from "@/lib/sessions";
import { formatAddress, type LineupEvent } from "@/lib/types";
import { getLineup, mainDate } from "@/lib/week";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SessionPicker } from "@/components/SessionPicker";
import { SubmitButton } from "@/components/SubmitButton";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  LockIcon,
  LogOutIcon,
  MapPinIcon,
  PencilIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
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

const VOICE: Session[] = ["leader", "sub_leader", "vocal"];

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { member, sessions } = await requireMember();
  const { saved, error } = await searchParams;
  const pinError = error === "current" || error === "new";
  const today = todayKST();

  // 확정된 라인업 중 내가 섬기는 일정
  const myEvents = await query<LineupEvent & { my_sessions: Session[] }>(
    `select e.*, array_agg(a.session) as my_sessions
       from lineup_assignments a join events e on e.id = a.event_id
      where a.member_id = $1 and e.lineup_status = 'confirmed' and e.end_date >= $2
      group by e.id order by e.start_date`,
    [member.id, `${today.slice(0, 4)}-01-01`],
  );
  await withDays(myEvents);
  const next = myEvents.find((e) => mainDate(e) >= today);
  const thisMonth = myEvents.filter((e) => mainDate(e).startsWith(today.slice(0, 7))).length;
  const doneThisYear = myEvents.filter((e) => mainDate(e) < today).length;
  const nextLeader = next ? (await getLineup(next.id)).filter((e) => e.session === "leader" && e.memberId !== member.id).map((e) => e.name) : [];
  const nextLeft = next ? daysUntil(mainDate(next)) : 0;

  return (
    <AppShell member={member} title="마이사역">
      <section className="panel">
        <div className="flex items-start gap-3">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xl font-extrabold text-navy-900">
            {member.name.slice(-2)}
            <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[20px] font-extrabold text-stone-900">{member.name}</span>
              {member.role === "admin" && <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600">관리자</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sessions.map((s) => (
                <span
                  key={s}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    VOICE.includes(s) ? "border-accent-300/70 bg-accent-50 text-accent-600" : "border-stone-200 bg-stone-50 text-stone-700"
                  }`}
                >
                  {SESSION_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
          <a href="#edit" className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">
            <PencilIcon size={13} />
            수정
          </a>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold text-stone-700">
            <CheckCircleIcon size={16} className="text-accent-600" />
            이번 달 섬김 <b className="text-stone-900">{thisMonth}회</b>
          </span>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">올해 {doneThisYear}회 섬김 완료</span>
        </div>
      </section>

      {next ? (
        <section className="relative mt-4 overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-accent-600 px-2.5 py-1 text-xs font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {nextLeft === 0 ? "D-day" : `D-${nextLeft}`} 다가오는 사역
            </span>
            <span className="text-sm font-semibold text-white/80">
              {formatMonthDay(mainDate(next))}({weekdayLabel(mainDate(next))})
            </span>
          </div>
          <h2 className="mt-3 text-[22px] font-extrabold tracking-tight">{next.type === "weekend" ? "주일 예배" : next.title}</h2>
          <p className="mt-0.5 text-sm text-white/70">
            내 역할: <b className="text-white">{next.my_sessions.map((s) => SESSION_LABELS[s]).join(", ")}</b>
            {nextLeader.length > 0 && ` · 예배 인도: ${nextLeader.join(", ")}`}
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-white/90">
              <ClockIcon size={17} />
              {practiceDates(next).length ? `토 연습 ${practiceDates(next).map(formatShort).join(", ")}` : "토 연습 없음"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/events/${next.id}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-navy-900">
              <FileIcon size={16} />
              콘티 &amp; 악보 확인
            </Link>
            <Link
              href={`/lineup?event=${next.id}`}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-accent-500/60 bg-accent-600/15 text-sm font-bold text-accent-300"
            >
              <UsersIcon size={16} />
              라인업 보기
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel mt-4 text-center">
          <p className="text-sm text-stone-600">아직 확정된 다가오는 섬김이 없어요.</p>
          <Link href="/availability" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-accent-600">
            가능일자 제출하러 가기 <ChevronRightIcon size={15} />
          </Link>
        </section>
      )}

      <h2 id="edit" className="mt-7 scroll-mt-20 text-[17px] font-extrabold text-stone-900">내 정보 수정</h2>
      <section className="panel relative mt-3">
        <p className="mb-3 text-xs text-stone-500">{formatPhone(member.phone)} · 전화번호를 바꾸려면 관리자에게 부탁하세요.</p>
        <Notice message={saved === "profile" ? SAVED.profile : undefined} />
        <Notice tone="error" message={error && !pinError ? ERRORS[error] : undefined} />
        <form action={updateProfile} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="address">거주지 (시·구·동까지)</label>
            <div className="relative">
              <MapPinIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="address"
                name="address"
                required
                maxLength={40}
                defaultValue={formatAddress(member)}
                placeholder="예: 수원시 장안구 조원동"
                className="field pl-10"
              />
            </div>
          </div>
          <fieldset className="relative">
            <legend className="field-label">기본 세션</legend>
            <div className="relative pt-1 [&>span:first-child]:-top-7 [&>span:first-child]:right-0">
              <SessionPicker sessions={SIGNUP_SESSIONS} defaultValue={sessions} />
            </div>
            <p className="mt-2 text-xs text-stone-500">가능일자를 낼 때 기본으로 채워지는 세션이에요. 이미 낸 응답은 바뀌지 않아요.</p>
          </fieldset>
          <SubmitButton className="h-11 w-full rounded-xl bg-navy-900 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">저장</SubmitButton>
        </form>
      </section>

      <section className="panel mt-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
          <LockIcon size={16} />
          PIN 바꾸기
        </h3>
        <div className="mt-3">
          <Notice message={saved === "pin" ? SAVED.pin : undefined} />
          <Notice tone="error" message={pinError ? ERRORS[error] : undefined} />
        </div>
        <form action={changePin} className="grid grid-cols-3 gap-2">
          <input name="current_pin" type="password" inputMode="numeric" required placeholder="지금 PIN" autoComplete="current-password" className="field px-2 text-center text-sm" />
          <input name="new_pin" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="새 PIN" autoComplete="new-password" className="field px-2 text-center text-sm" />
          <input name="new_pin_confirm" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="새 PIN 확인" autoComplete="new-password" className="field px-2 text-center text-sm" />
          <SubmitButton className="col-span-3 h-11 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-800 hover:bg-stone-50 disabled:opacity-60">PIN 바꾸기</SubmitButton>
        </form>
      </section>

      <ul className="panel mt-4 divide-y divide-stone-100 p-0">
        <MenuRow href="/availability" icon={<SendIcon size={18} />} title="사역 가능일 제출" sub="매달 섬길 수 있는 날을 알려 주세요" />
        <MenuRow href="/calendar" icon={<CalendarIcon size={18} />} title="사역 캘린더" sub="확정된 라인업을 날짜별로 봐요" />
        {member.role === "admin" && <MenuRow href="/admin" icon={<SettingsIcon size={18} />} title="관리" sub="회차·라인업 편성, 가입 승인, 초대코드" />}
        <li>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-stone-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <LogOutIcon size={18} />
              </span>
              <span className="flex-1 text-[15px] font-bold text-stone-900">로그아웃</span>
              <ChevronRightIcon size={18} className="text-stone-400" />
            </button>
          </form>
        </li>
      </ul>

      <p className="mt-6 text-center text-xs text-stone-500">&ldquo;호흡이 있는 자마다 여호와를 찬양할지어다&rdquo; (시편 150:6)</p>
    </AppShell>
  );
}

function MenuRow({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-stone-900">{title}</span>
          <span className="block truncate text-xs text-stone-500">{sub}</span>
        </span>
        <ChevronRightIcon size={18} className="text-stone-400" />
      </Link>
    </li>
  );
}
