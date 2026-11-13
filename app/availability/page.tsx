import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getOpenEvents } from "@/lib/queries";
import { daysUntil, formatMonth, formatMonthDay, formatShort, parseISODate, weekdayLabel, weekOfMonthLabel } from "@/lib/dates";
import { serviceDates } from "@/lib/lineup";
import { SESSION_LABELS, SESSIONS, type Session } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, hasSaturdayPractice, statusOptionsFor, type Availability } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { ArrowLeftIcon, CalendarIcon, CheckCircleIcon, ClockIcon, SendIcon, XCircleIcon } from "@/components/icons";
import { saveAvailability } from "./actions";

const ERRORS: Record<string, string> = {
  empty: "응답을 하나 이상 골라 주세요.",
  save: "저장하지 못했어요. 마감됐거나 라인업이 이미 확정된 일정이 있을 수 있어요.",
};

const VOICE: Session[] = ["leader", "sub_leader", "vocal"];

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { member, sessions: mySessions } = await requireMember();
  const { saved, error } = await searchParams;
  const { rounds, events } = await getOpenEvents();

  const answers = await query<Availability>(
    `select * from availabilities where member_id = $1 and event_id = any($2::uuid[])`,
    [member.id, events.map((e) => e.id)],
  );
  const answerByEvent = new Map(answers.map((a) => [a.event_id, a]));

  // 기본 세션이 아닌 것도 추가로 고를 수 있게 전체 목록을 보여준다(서브 인도자 제외)
  const selectable = SESSIONS.filter((s) => s !== "sub_leader");
  const months = rounds.map((r) => formatMonth(r.target_month.slice(0, 7)).replace(/^\d+년 /, ""));
  const deadline = rounds.find((r) => r.closes_at)?.closes_at;
  const left = deadline ? daysUntil(deadline.slice(0, 10)) : null;
  const percent = events.length ? Math.round((answers.length / events.length) * 100) : 0;

  return (
    <AppShell member={member}>
      <div className="flex items-center gap-2">
        <Link href="/calendar" aria-label="뒤로" className="-ml-1 p-1 text-stone-900">
          <ArrowLeftIcon size={22} />
        </Link>
        <h1 className="flex-1 truncate text-[20px] font-extrabold tracking-tight text-stone-900">
          {months.length ? `${months.join("·")} 사역 가능일 제출` : "사역 가능일 제출"}
        </h1>
        {left !== null && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-accent-300/70 bg-accent-50 px-2.5 py-1 text-xs font-extrabold text-accent-600">
            <ClockIcon size={13} />
            {left <= 0 ? "오늘 마감" : `D-${left}`}
          </span>
        )}
      </div>

      <section className="panel mt-4">
        <div className="flex gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-900 text-lg font-extrabold text-white">
            {member.name.slice(-2)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[17px] font-extrabold text-stone-900">{member.name}</span>
              {mySessions.map((s) => (
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
            <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
              {events.length === 0 ? (
                "지금 받고 있는 수집 회차가 없어요."
              ) : (
                <>
                  섬길 수 있는 날을 골라 주세요.{" "}
                  {deadline && <span className="font-bold text-accent-600">{formatShort(deadline.slice(0, 10))} 마감 · </span>}
                  마감 전까지 언제든 고칠 수 있어요.
                </>
              )}
            </p>
          </div>
        </div>
        {events.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-stone-600">
              <CheckCircleIcon size={14} />
              응답 진척도: {answers.length} / {events.length} 일정
            </span>
            <span className="font-extrabold text-accent-600">{percent}%</span>
          </div>
        )}
      </section>

      <div className="mt-4">
        <Notice message={saved ? "저장했어요. 마감 전까지 언제든 고칠 수 있어요." : undefined} />
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />
      </div>

      {events.length > 0 && (
        <form action={saveAvailability}>
          <div className="mb-3 mt-2 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-stone-900">
              <CalendarIcon size={18} />
              정기 예배 및 특별 집회
            </h2>
            <span className="text-xs font-semibold text-stone-500">총 {events.length}회 일정</span>
          </div>

          <div className="space-y-3">
            {events.map((event) => {
              const answer = answerByEvent.get(event.id);
              const chosen = new Set<Session>(answer && answer.status !== "none" ? answer.sessions : mySessions);
              const date = serviceDates(event).at(-1) ?? event.end_date;
              const weekend = event.type === "weekend";
              return (
                <section
                  key={event.id}
                  className="panel transition has-[input[value=none]:checked]:border-red-200 has-[input[value=none]:checked]:bg-red-50/30"
                >
                  <input type="hidden" name="event_id" value={event.id} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                            weekend ? "bg-stone-100 text-stone-600" : "bg-accent-50 text-accent-600"
                          }`}
                        >
                          {weekend ? "정기예배" : EVENT_TYPE_LABELS[event.type]}
                        </span>
                        <h3 className="truncate text-[17px] font-extrabold text-stone-900">
                          {weekend ? weekOfMonthLabel(date) : event.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-[13px] text-stone-500">
                        {serviceDates(event)
                          .map((d) => `${formatMonthDay(d)}(${parseISODate(d).getUTCDay() === 0 ? "주일" : weekdayLabel(d)})`)
                          .join(", ")}
                        {event.note && ` · ${event.note}`}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${hasSaturdayPractice(event) ? "text-accent-600" : "text-stone-500"}`}>
                      {weekend ? (hasSaturdayPractice(event) ? `토 연습 ${formatShort(event.start_date)}` : "토 연습 없음") : ""}
                    </span>
                  </div>

                  <div className={`mt-3 grid gap-2 ${statusOptionsFor(event).length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {statusOptionsFor(event).map((opt) => {
                      const no = opt.value === "none";
                      return (
                        <label key={opt.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`status_${event.id}`}
                            value={opt.value}
                            defaultChecked={answer?.status === opt.value}
                            className="peer sr-only"
                          />
                          <span
                            className={`flex h-11 items-center justify-center gap-1 rounded-xl border border-stone-200 bg-stone-100/80 text-sm font-semibold text-stone-600 transition peer-focus-visible:ring-2 peer-focus-visible:ring-navy-900/30 ${
                              no
                                ? "peer-checked:border-2 peer-checked:border-red-400 peer-checked:bg-white peer-checked:text-red-600"
                                : "peer-checked:border-navy-900 peer-checked:bg-navy-900 peer-checked:text-white"
                            }`}
                          >
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {hasSaturdayPractice(event) && (
                    <p className="mt-2 text-xs text-stone-500">
                      토 연습에 못 와도(&apos;토 불가&apos;) 주일 라인업에는 들어갈 수 있어요. 토 연습에 오는 팀원을 먼저 배정해요.
                    </p>
                  )}

                  <details className="group mt-3 rounded-xl border border-stone-200 bg-white" open={!answer}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs">
                      <span className="min-w-0 truncate text-stone-600">
                        <span className="font-bold text-stone-800">섬길 세션 · </span>
                        {[...chosen].map((s) => SESSION_LABELS[s]).join(", ") || "없음"}
                        {answer?.comment && <span className="text-stone-400"> · 메모 있음</span>}
                      </span>
                      <span className="shrink-0 font-semibold text-stone-500 group-open:hidden">고치기</span>
                    </summary>
                    <div className="border-t border-stone-100 px-3 pb-3 pt-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {selectable.map((s) => (
                          <label key={s} className="cursor-pointer">
                            <input type="checkbox" name={`sessions_${event.id}`} value={s} defaultChecked={chosen.has(s)} className="peer sr-only" />
                            <span className="flex h-8 items-center rounded-lg border border-stone-200 bg-stone-50 px-2.5 text-xs font-semibold text-stone-600 transition peer-checked:border-navy-900 peer-checked:bg-navy-900 peer-checked:text-white">
                              {SESSION_LABELS[s]}
                            </span>
                          </label>
                        ))}
                      </div>
                      <input
                        name={`comment_${event.id}`}
                        defaultValue={answer?.comment ?? ""}
                        placeholder="전달사항 (예: 예배 후 바로 이동해야 해요, 카풀 가능)"
                        maxLength={200}
                        className="field mt-2.5 h-11 text-sm"
                      />
                    </div>
                  </details>
                </section>
              );
            })}
          </div>

          <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-stone-200 bg-stone-100/70 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
            <XCircleIcon size={14} className="mt-px shrink-0" />
            라인업이 확정된 일정은 응답을 더 고칠 수 없어요. 그 뒤에 일정이 바뀌면 관리자에게 알려 주세요.
          </p>

          <div className="sticky bottom-20 z-10 mt-4">
            <SubmitButton
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-base font-bold text-white shadow-lg transition hover:bg-navy-800 disabled:opacity-60"
              pendingText="저장 중…"
            >
              <SendIcon size={18} />
              {answers.length ? "사역 가능일 다시 제출하기" : "사역 가능일 제출하기"}
            </SubmitButton>
          </div>
        </form>
      )}
    </AppShell>
  );
}
