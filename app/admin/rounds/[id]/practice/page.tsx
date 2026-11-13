import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { withDays } from "@/lib/queries";
import { practiceDates } from "@/lib/lineup";
import { formatMonth, formatShort, parseISODate } from "@/lib/dates";
import { SESSION_SHORT, SIGNUP_SESSIONS } from "@/lib/sessions";
import { canServe, hasSaturdayPractice, type Availability, type LineupEvent, type Round } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { CalendarIcon, CheckIcon, LightbulbIcon, LockIcon, TableIcon, UserPlusIcon, XIcon } from "@/components/icons";
import { toggleSaturdayPractice } from "../../../actions";

const monthDay = (s: string) => {
  const d = parseISODate(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

/** 주차별 토요일 연습 있음/없음 설정 (누르는 즉시 저장) */
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await requireAdmin();

  const round = await queryOne<Round>(`select * from availability_rounds where id = $1`, [id]);
  if (!round) notFound();

  const [allEvents, answers] = await Promise.all([
    query<LineupEvent>(`select * from events where round_id = $1 order by start_date`, [id]).then(withDays),
    query<Availability>(
      `select a.* from availabilities a join events e on e.id = a.event_id where e.round_id = $1`,
      [id],
    ),
  ]);
  const events = allEvents.filter((e) => e.type === "weekend");
  const roundLabel = formatMonth(round.target_month.slice(0, 7));
  const roundHref = `/admin/rounds/${round.id}`;
  const drafting = events.some((e) => e.lineup_status === "draft");

  const rows = events.map((e) => {
    const answered = answers.filter((a) => a.event_id === e.id);
    const available = answered.filter((a) => canServe(a.status));
    const sunOnly = answered.filter((a) => a.status === "sun_only").length;
    return {
      event: e,
      practice: hasSaturdayPractice(e),
      practiceDay: practiceDates(e)[0] ?? e.start_date,
      counts: SIGNUP_SESSIONS.map((s) => available.filter((a) => a.sessions.includes(s)).length),
      available: available.length,
      sunOnly,
    };
  });
  const totalAvailable = rows.reduce((n, r) => n + r.available, 0);
  const totalAnswered = answers.filter((a) => events.some((e) => e.id === a.event_id) && a.status !== "none").length;

  return (
    <AppShell
      member={member}
      back={{ href: roundHref, label: "응답 현황" }}
      title="토요일 연습 유무 설정"
      action={
        <Link href={roundHref} className="rounded-lg bg-ink-900 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-navy-800">
          완료
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-600">
            <CalendarIcon size={15} />
            {roundLabel} 응답 관리
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
              drafting ? "bg-ember-50 text-ember-600" : "bg-sage-50 text-sage-700"
            }`}
          >
            {drafting ? "편성 진행 중" : "모두 확정됨"}
          </span>
        </div>

        <section className="rounded-2xl border border-gold-300/70 bg-gradient-to-br from-gold-50 to-white p-4">
          <h1 className="flex items-center gap-2 text-[17px] font-extrabold text-ink-900">
            <LightbulbIcon size={19} className="text-ember-600" />
            토요일 연습 유무 안내
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-stone-700">
            토요일 연습이 있는 주에도 <b className="text-ember-600">&apos;토 불가&apos;</b>로 답한 팀원을 주일 라인업에 넣을 수 있어요.
            다만 자동 배정은 토 연습에 오는 사람을 먼저 넣고, 그 파트에 다른 사람이 없을 때만 &apos;토 불참&apos;으로 넣어요. 연습이 없는
            주(주일 당일 리허설 등)로 바꾸면 &apos;토 불가&apos; 응답은 &apos;가능&apos;으로 바뀌어요.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <TableIcon size={16} />
              토 연습 설정에 따른 가용 인원
            </h2>
            <span className="shrink-0 text-[11px] font-semibold text-stone-500">실시간 연동</span>
          </div>
          <div className="overflow-x-auto px-2">
            <table className="w-full min-w-[440px] text-center text-[13px]">
              <thead className="text-[11px] font-bold text-stone-500">
                <tr>
                  <th className="px-2 py-2.5 text-left">주일</th>
                  {SIGNUP_SESSIONS.map((s) => (
                    <th key={s} className="px-1 py-2.5">{SESSION_SHORT[s]}</th>
                  ))}
                  <th className="px-2 py-2.5 text-ember-600">토불가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.event.id} className={r.practice ? "" : "bg-ember-50/60"}>
                    <td className={`whitespace-nowrap px-2 py-2.5 text-left font-semibold ${r.practice ? "text-ink-900" : "text-ember-600"}`}>
                      {monthDay(r.event.end_date)}
                      {!r.practice && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ember-600 align-middle" />}
                    </td>
                    {r.counts.map((n, i) => (
                      <td key={SIGNUP_SESSIONS[i]} className={n ? "font-bold text-ink-900" : "text-stone-300"}>{n}</td>
                    ))}
                    <td className="whitespace-nowrap px-2">
                      {r.sunOnly && r.practice ? (
                        <span className="font-bold text-ember-600">
                          {r.sunOnly}
                          <span className="text-[10px] font-semibold">(토 불참)</span>
                        </span>
                      ) : (
                        <span className="text-stone-300">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-2.5 text-[11px] text-stone-500">
            <span>* 점 표시된 주는 토 연습이 없는 주예요. 숫자에는 &apos;토 불가&apos; 팀원도 포함돼요.</span>
            <span className="shrink-0 font-semibold text-ember-600">
              총 가용 {totalAvailable}/{totalAnswered}
            </span>
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[18px] font-extrabold text-ink-900">주차별 토요일 연습 토글</h2>
            <span className="text-xs font-semibold text-stone-500">총 {rows.length}주차 구성</span>
          </div>
          <div className="space-y-3">
            {rows.map((r, i) => {
              const locked = r.event.lineup_status !== "draft";
              return (
                <article
                  key={r.event.id}
                  className={`rounded-2xl border bg-white p-4 ${
                    r.practice ? "border-stone-200 shadow-[0_2px_8px_rgba(27,36,56,0.03)]" : "border-ember-200 bg-gradient-to-b from-ember-50/70 to-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        r.practice ? "bg-stone-100 text-stone-700" : "bg-ember-50 text-ember-600"
                      }`}
                    >
                      {i + 1}주
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[18px] font-extrabold text-ink-900">{formatShort(r.event.end_date)}</span>
                        <span className={`text-xs font-semibold ${r.practice ? "text-stone-500" : "text-ember-600"}`}>
                          {r.practice ? `연습일: ${formatShort(r.practiceDay)}` : `${formatShort(r.event.start_date)} 연습 없음`}
                        </span>
                      </div>
                      <p className={`text-[13px] ${r.practice ? "text-stone-600" : "text-ember-600"}`}>
                        {r.practice ? "토요일 연습 후 주일 섬김" : "주일 당일 리허설로 대체"}
                      </p>
                    </div>
                    {locked ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500">
                        <LockIcon size={13} />
                        확정됨 · {r.practice ? "있음" : "없음"}
                      </span>
                    ) : (
                      <form action={toggleSaturdayPractice} className="shrink-0">
                        <input type="hidden" name="event_id" value={r.event.id} />
                        <SubmitButton
                          pendingText="저장 중…"
                          title={r.practice ? "누르면 이 주는 토 연습 없음" : "누르면 토 연습을 다시 넣어요"}
                          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 disabled:opacity-60 ${
                            r.practice
                              ? "bg-ink-900 text-white hover:bg-navy-800"
                              : "border border-stone-300 bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          {r.practice ? <CheckIcon size={15} strokeWidth={2.4} /> : <XIcon size={15} />}
                          {r.practice ? "있음" : "없음 (자율)"}
                        </SubmitButton>
                      </form>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 text-[13px]">
                    {!r.practice ? (
                      <>
                        <span className="flex items-center gap-1.5 font-semibold text-ember-600">
                          <UserPlusIcon size={15} />
                          토 연습 없음 · 모두 같은 조건으로 배정
                        </span>
                        <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-ember-600">가용 {r.available}명</span>
                      </>
                    ) : r.sunOnly ? (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-md border border-ember-200 bg-ember-50 px-2 py-0.5 text-[11px] font-bold text-ember-600">
                            토불가 {r.sunOnly}명
                          </span>
                          <span className="truncate text-stone-600">가용 {r.available}명 (토 불참 포함)</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-ember-600">부족할 때만 배정</span>
                      </>
                    ) : (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-md border border-sage-200 bg-sage-50 px-2 py-0.5 text-[11px] font-bold text-sage-700">
                            가용 {r.available}명
                          </span>
                          <span className="truncate text-stone-600">토불가 인원 없음</span>
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">정상 배정 풀</span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {rows.length === 0 && <p className="panel text-center text-sm text-stone-500">이 회차에는 주일 일정이 없어요.</p>}
          </div>
        </section>

        <div>
          <Link
            href={roundHref}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-[15px] font-bold text-white shadow-[0_8px_24px_-4px_rgba(27,36,56,0.25)] hover:bg-navy-800"
          >
            <CheckIcon size={18} strokeWidth={2.4} />
            설정 완료 · 응답 현황으로
          </Link>
          <p className="mt-2 text-center text-xs text-stone-500">
            버튼을 누르는 즉시 저장되고, {roundLabel} 응답 현황과 자동 배정에 바로 반영돼요. 확정된 주는 확정을 풀어야 바꿀 수 있어요.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
