import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getMemberNames, withDays } from "@/lib/queries";
import { buildLineup, groupBySession } from "@/lib/lineup";
import { formatMonth, formatShort, parseISODate } from "@/lib/dates";
import { REQUIRED_SESSIONS, SESSION_LABELS, SESSION_SHORT, SIGNUP_SESSIONS, type Session } from "@/lib/sessions";
import {
  canServe,
  EVENT_TYPE_LABELS,
  hasSaturdayPractice,
  type Assignment,
  type Availability,
  type Guest,
  type LineupEvent,
  type Member,
  type Round,
} from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Notice } from "@/components/Notice";
import { AutoAssignOptions } from "@/components/AutoAssignOptions";
import { RoleChip, SESSION_TONE } from "@/components/RoleChip";
import { ServeCountTable } from "@/components/ServeCountTable";
import { SubmitButton } from "@/components/SubmitButton";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SlidersIcon,
  SparklesIcon,
  TableIcon,
  TrashIcon,
} from "@/components/icons";
import { autoAssignRound, confirmRound, deleteRound, setRoundStatus, toggleSaturdayPractice } from "../../actions";

const SAVED: Record<string, string> = {
  confirm: "편성 중이던 주를 모두 확정했어요. 팀원 캘린더에 바로 보여요.",
};

/** '2026-11-01' → '11/1' */
const monthDay = (s: string) => {
  const d = parseISODate(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; scope?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, scope, error } = await searchParams;
  const { member } = await requireAdmin();

  const round = await queryOne<Round>(`select * from availability_rounds where id = $1`, [id]);
  if (!round) notFound();

  const [events, answers, members] = await Promise.all([
    query<LineupEvent>(`select * from events where round_id = $1 order by start_date`, [id]).then(withDays),
    query<Availability>(
      `select a.* from availabilities a join events e on e.id = a.event_id where e.round_id = $1`,
      [id],
    ),
    query<Pick<Member, "id" | "name">>(`select id, name from members where status = 'approved' order by name`),
  ]);

  const eventIds = events.map((e) => e.id);
  const [assignments, guests] = await Promise.all([
    query<Assignment>(`select * from lineup_assignments where event_id = any($1::uuid[])`, [eventIds]),
    query<Guest>(`select * from lineup_guests where event_id = any($1::uuid[]) order by name`, [eventIds]),
  ]);
  const names = await getMemberNames(assignments.map((a) => a.member_id));
  const lineups = new Map(
    events.map((e) => [
      e.id,
      buildLineup(
        assignments.filter((a) => a.event_id === e.id),
        names,
        guests.filter((g) => g.event_id === e.id),
      ),
    ]),
  );
  // 사람·세션별 가능한 주 수 (섬김 횟수 표의 분모)
  const availableWeeks = new Map<string, number>();
  const eventById = new Map(events.map((e) => [e.id, e]));
  for (const a of answers) {
    const ev = eventById.get(a.event_id);
    if (!ev || !canServe(a.status, ev)) continue;
    for (const s of a.sessions) availableWeeks.set(`${a.member_id}:${s}`, (availableWeeks.get(`${a.member_id}:${s}`) ?? 0) + 1);
  }
  /** 그 주에 그 세션으로 편성할 수 있는 인원 */
  const availableCount = (e: LineupEvent, s: Session) =>
    answers.filter((a) => a.event_id === e.id && canServe(a.status, e) && a.sessions.includes(s)).length;

  // 주별 배정 결과: 채워진 세션·공석
  const weeks = events.map((e) => {
    const groups = groupBySession(lineups.get(e.id) ?? []);
    const filled = new Set(groups.map((g) => g.session));
    const vacant = REQUIRED_SESSIONS.filter((s) => !filled.has(s));
    return { event: e, groups, vacant, filledCount: REQUIRED_SESSIONS.length - vacant.length };
  });
  const draftWeeks = weeks.filter((w) => w.event.lineup_status === "draft");
  const draftCount = draftWeeks.length;
  const openSeats = draftWeeks.reduce((n, w) => n + w.vacant.length, 0);
  const fullWeeks = weeks.filter((w) => w.vacant.length === 0).length;
  const weeksWithVacancy = weeks.filter((w) => w.vacant.length > 0).length;
  const weekendIndex = new Map(events.filter((e) => e.type === "weekend").map((e, i) => [e.id, i + 1]));

  const responded = new Set(answers.map((a) => a.member_id));
  const missing = members.filter((m) => !responded.has(m.id));
  const confirmedCount = events.filter((e) => e.lineup_status === "confirmed").length;
  const roundLabel = formatMonth(round.target_month.slice(0, 7));
  const isOpen = round.status === "open";
  const justAssigned = saved === "auto";
  const deleteMessage = [
    `${roundLabel} 회차를 삭제할까요?`,
    `함께 지워지는 것: 주일 일정 ${events.length}개, 팀원 응답 ${answers.length}건${confirmedCount ? `, 확정된 라인업 ${confirmedCount}개 (캘린더에서도 사라져요)` : ""}`,
    "삭제하면 되돌릴 수 없어요.",
  ].join("\n\n");

  const confirmAllForm = (big: boolean) => (
    <form action={confirmRound}>
      <input type="hidden" name="round_id" value={round.id} />
      <ConfirmSubmitButton
        confirmMessage={`편성 중인 ${draftCount}주를 모두 확정하고 팀원에게 공개할까요?`}
        pendingText="확정 중…"
        className={
          big
            ? "flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_24px_-4px_rgba(27,36,56,0.25)] hover:bg-navy-800 disabled:opacity-60"
            : "flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-bold text-ember-600 hover:bg-ember-50 disabled:opacity-60"
        }
      >
        {big ? (
          <>
            <CheckCircleIcon size={19} />
            자동 배정 결과 이대로 확정하기
          </>
        ) : (
          <>
            모두 일괄 확정
            <CheckIcon size={15} strokeWidth={2.4} />
          </>
        )}
      </ConfirmSubmitButton>
    </form>
  );

  return (
    <AppShell member={member} back={{ href: "/admin", label: "관리" }} title="J4U Worship">
      <div className="space-y-5">
        {/* 회차 요약 */}
        <section className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isOpen ? "bg-ember-50 text-ember-600" : "bg-stone-100 text-stone-600"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "animate-pulse bg-ember-600" : "bg-stone-400"}`} />
                {isOpen ? "수집 진행 중" : "수집 마감"}
              </span>
              <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{roundLabel} 응답 현황</h1>
              <p className="mt-1 text-[13px] text-stone-600">
                응답 {responded.size}/{members.length}명 완료
                {round.closes_at && ` · ${formatShort(round.closes_at.slice(0, 10))} 마감`}
              </p>
            </div>
            <form action={setRoundStatus} className="shrink-0">
              <input type="hidden" name="round_id" value={round.id} />
              <input type="hidden" name="status" value={isOpen ? "closed" : "open"} />
              <SubmitButton
                className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-60"
                pendingText="…"
              >
                {isOpen ? "수집 마감" : "다시 열기"}
              </SubmitButton>
            </form>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4">
            <Metric label="총 주일" value={`${events.length}회`} />
            <Metric label="응답 인원" value={`${responded.size}명`} />
            <Metric label="배정 필요석" value={`${openSeats}석`} warn={openSeats > 0} />
          </div>
        </section>

        <Notice message={saved ? SAVED[saved] : undefined} />
        <Notice tone="error" message={error === "scope" ? "자동 배정할 범위(보컬·악기)를 하나 이상 골라 주세요." : undefined} />

        {/* 자동 배정 직후 요약 */}
        {justAssigned && (
          <section className="panel">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-gold-300">
                <SparklesIcon size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold text-ink-900">
                  {scope === "vocal" ? "보컬" : scope === "instrument" ? "악기" : "스마트 알고리즘"} 자동 배정 완료!
                </h2>
                <p className="mt-0.5 text-[13px] leading-relaxed text-stone-600">
                  총 {events.length}개 주일 중 <b className="text-ink-900">{fullWeeks}주일 100% 매칭 완료</b>
                  {weeksWithVacancy > 0 && (
                    <span className="font-semibold text-ember-600">
                      {" "}
                      · {weeksWithVacancy}개 주일 공석 {openSeats}석 발생
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
              <span className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-3 py-2">
                <SlidersIcon size={14} className="shrink-0" />
                공평 분배 가중치 적용됨
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-3 py-2">
                <ClockIcon size={14} className="shrink-0" />
                토요일 연습 조건 100% 반영
              </span>
            </div>
          </section>
        )}

        {/* 주차별 가용 세션 현황 */}
        <section className="panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[16px] font-extrabold text-ink-900">
              <TableIcon size={18} />
              주차별 가용 세션 현황
            </h2>
            <Link
              href={`/admin/rounds/${round.id}/practice`}
              className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-stone-500 hover:text-ink-900"
            >
              토 연습 설정
              <ChevronRightIcon size={14} />
            </Link>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <table className="w-full min-w-[540px] border-collapse text-center text-[13px]">
              <thead>
                <tr className="bg-stone-50 text-[11px] font-bold text-stone-500">
                  <th className="rounded-l-lg px-2 py-2.5 text-left">주일</th>
                  {SIGNUP_SESSIONS.map((s) => (
                    <th key={s} className="px-1.5 py-2.5">{SESSION_SHORT[s]}</th>
                  ))}
                  <th className="px-2 py-2.5 text-ember-600">토 불가</th>
                  <th className="rounded-r-lg px-2.5 py-2.5">토 연습</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {events.map((e) => {
                  const sunOnly = answers.filter((a) => a.event_id === e.id && a.status === "sun_only").length;
                  const practice = hasSaturdayPractice(e);
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-2 py-2.5 text-left font-semibold text-ink-900">{formatShort(e.end_date)}</td>
                      {SIGNUP_SESSIONS.map((s) => {
                        const count = availableCount(e, s);
                        return (
                          <td key={s} className={count === 0 ? "text-stone-300" : "rounded bg-ink-50 font-bold text-ink-900"}>
                            {count}
                          </td>
                        );
                      })}
                      <td className={sunOnly ? "font-bold text-ember-600" : "text-stone-300"}>{sunOnly}</td>
                      <td className="whitespace-nowrap py-2">
                        {e.type !== "weekend" ? (
                          <span className="text-[11px] text-stone-400">{EVENT_TYPE_LABELS[e.type]}</span>
                        ) : e.lineup_status === "draft" ? (
                          <form action={toggleSaturdayPractice}>
                            <input type="hidden" name="event_id" value={e.id} />
                            <SubmitButton
                              pendingText="…"
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition active:scale-95 ${
                                practice
                                  ? "border-stone-300 bg-stone-100 text-ink-900"
                                  : "border-gold-300 bg-gold-50 text-gold-700"
                              }`}
                              title={practice ? "누르면 이 주는 토 연습 없음" : "누르면 토 연습을 다시 넣어요"}
                            >
                              {practice ? "있음" : "없음"}
                            </SubmitButton>
                          </form>
                        ) : (
                          <span className="text-[11px] text-stone-500">{practice ? "있음" : "없음"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-start gap-2 border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-600">
            <InfoIcon size={15} className="mt-0.5 shrink-0 text-ink-900" />
            <span>
              숫자는 세션별로 편성할 수 있는 인원이에요 (토 연습이 있는 주의 &apos;토 불가&apos;는 빼고 세요). 토요일 연습이 없는 주는{" "}
              <b className="text-ink-900">&apos;토 연습&apos;</b>을 눌러 &apos;없음&apos;으로 바꾸면 팀원은 그 주를 가능/불가로만 답하고, 토 불가
              인원도 배정 풀에 들어가요.
            </span>
          </p>
        </section>

        {/* 자동 배정 */}
        <section id="auto" className="panel scroll-mt-20 space-y-4 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-ink-900">
              <SparklesIcon size={18} />
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-ink-900">자동 배정 알고리즘</h2>
              <p className="text-[11px] font-semibold text-stone-500">공평 분배 &amp; 연습 제약 자동 반영</p>
            </div>
          </div>
          <p className="rounded-xl border border-stone-200/70 bg-stone-50 p-3 text-[12.5px] leading-relaxed text-stone-600">
            파트마다 가능하다고 답한 주에만, 한 달 섬김 횟수가 고르게 되도록 나눠 넣어요. &apos;토 불가&apos;인 사람은 토 연습이 없는 주에만
            넣고, 한 사람은 한 주에 한 파트만 맡아요. 확정된 주는 바꾸지 않고 횟수에만 셈해요.
          </p>
          <form action={autoAssignRound} className="space-y-4">
            <input type="hidden" name="round_id" value={round.id} />
            <AutoAssignOptions draftCount={draftCount} />
          </form>
        </section>

        {/* 주차별 배정 결과 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-extrabold text-ink-900">주차별 배정 결과</h2>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{events.length}주 편성</span>
            </div>
            {draftCount > 0 && confirmAllForm(false)}
          </div>

          {weeks.map(({ event: e, groups, vacant, filledCount }) => {
            const confirmed = e.lineup_status === "confirmed";
            const empty = groups.length === 0;
            const short = !confirmed && !empty && vacant.length > 0;
            const index = weekendIndex.get(e.id);
            const scarce = vacant.filter((s) => availableCount(e, s) === 0);
            return (
              <article
                key={e.id}
                className={`rounded-2xl border p-4 ${
                  short
                    ? "border-dashed border-gold-500 bg-gradient-to-b from-gold-50/70 to-white"
                    : "border-stone-200 bg-white shadow-[0_2px_8px_rgba(27,36,56,0.03)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[22px] font-extrabold tracking-tight text-ink-900">{monthDay(e.end_date)}</span>
                    <span className="text-xs font-semibold text-stone-600">
                      {e.type === "weekend" ? `${index}주차 주일예배` : e.title}
                    </span>
                    {e.type === "weekend" ? (
                      <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">
                        토 연습 {hasSaturdayPractice(e) ? "있음" : "없음"}
                      </span>
                    ) : (
                      <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">
                        {EVENT_TYPE_LABELS[e.type]}
                      </span>
                    )}
                  </div>
                  <WeekStatus confirmed={confirmed} empty={empty} vacant={vacant.length} />
                </div>

                {short && scarce.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-300 bg-gold-50 px-3 py-2.5 text-[13px]">
                    <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-ember-600" />
                    <p className="text-stone-700">
                      <b className="text-ink-900">{scarce.map((s) => SESSION_LABELS[s]).join(", ")}</b> 가용 인원 부족 (신청 0명)
                      <br />
                      <span className="text-xs text-stone-500">게스트를 넣거나 다른 세션으로 대체해 주세요.</span>
                    </p>
                  </div>
                )}

                {empty ? (
                  <p className="mt-3 text-[13px] text-stone-400">배정된 인원이 없어요</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {groups.flatMap((g) =>
                      g.entries.map((x) => (
                        <RoleChip key={`${g.session}-${x.key}`} session={g.session} short className="py-1">
                          {x.name}
                          {x.guest && <span className="ml-0.5 text-[10px] font-semibold text-stone-500">(G)</span>}
                          {x.satAbsent && <span className="ml-0.5 text-[10px] font-semibold text-red-600">토✕</span>}
                        </RoleChip>
                      )),
                    )}
                    {short &&
                      vacant.map((s) => (
                        <span
                          key={s}
                          className={`inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-1 text-[11px] font-bold ${SESSION_TONE[s]} bg-white`}
                        >
                          <PlusIcon size={11} strokeWidth={2.6} />
                          {SESSION_SHORT[s]} (공석)
                        </span>
                      ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <span className={`text-xs ${short ? "font-semibold text-ember-600" : "text-stone-500"}`}>
                    {empty
                      ? "편성 대기"
                      : vacant.length
                        ? `${vacant.length}개 포지션 충원 필요`
                        : `포지션 ${filledCount}/${REQUIRED_SESSIONS.length} 매칭 완료`}
                  </span>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-bold text-ink-900 hover:bg-stone-100"
                  >
                    {confirmed ? "보기" : empty ? "편성하기" : "세부 조정"}
                    <PencilIcon size={13} />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        {/* 파트별 섬김 횟수 */}
        <section className="panel p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-extrabold text-ink-900">파트별 섬김 횟수 집계</h2>
            <span className="shrink-0 text-[11px] text-stone-500">배정 / 가능 주 수</span>
          </div>
          <p className="mb-3 mt-1 text-xs text-stone-500">팀원별로 가능하다고 답한 주 대비 실제 배정된 횟수예요. (게스트 제외)</p>
          <ServeCountTable members={members} assignments={assignments} availableWeeks={availableWeeks} />
        </section>

        {justAssigned && draftCount > 0 && (
          <div className="space-y-2">
            {confirmAllForm(true)}
            <Link
              href="#auto"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              <SlidersIcon size={16} />
              조건 다시 설정하고 재배정
            </Link>
          </div>
        )}

        {/* 미제출 */}
        <section className="panel flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                missing.length ? "bg-gold-50 text-gold-700" : "bg-sage-50 text-sage-700"
              }`}
            >
              {missing.length ? <AlertCircleIcon size={20} /> : <CheckCircleIcon size={20} />}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink-900">미제출 {missing.length}명</h2>
              <p className="text-xs text-stone-500">
                {missing.length ? missing.map((m) => m.name).join(", ") : "팀원 모두 이번 달 응답을 마쳤어요."}
              </p>
            </div>
          </div>
          {!missing.length && (
            <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">완료</span>
          )}
        </section>

        {/* 회차 삭제 */}
        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-red-700">
            <AlertTriangleIcon size={19} />
            회차 관리 (위험 구역)
          </h2>
          <p className="mb-4 mt-2 text-[12.5px] leading-relaxed text-stone-600">
            이 달의 주일 일정과 팀원 응답, 확정된 라인업이 모두 함께 지워지고 되돌릴 수 없어요. 신중히 결정해 주세요.
          </p>
          <form action={deleteRound}>
            <input type="hidden" name="round_id" value={round.id} />
            <ConfirmSubmitButton
              confirmMessage={deleteMessage}
              pendingText="삭제 중…"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-600 px-4 py-2.5 text-[13px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              <TrashIcon size={16} />
              {roundLabel} 회차 데이터 삭제
            </ConfirmSubmitButton>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2 text-center">
      <span className="block text-[11px] font-bold text-stone-500">{label}</span>
      <span className={`text-[18px] font-extrabold ${warn ? "text-ember-600" : "text-ink-900"}`}>{value}</span>
    </div>
  );
}

function WeekStatus({ confirmed, empty, vacant }: { confirmed: boolean; empty: boolean; vacant: number }) {
  if (confirmed)
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sage-50 px-2.5 py-1 text-[11px] font-bold text-sage-700">
        <CheckCircleIcon size={12} />
        확정
      </span>
    );
  if (empty)
    return <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-500">편성 대기</span>;
  if (vacant)
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
        <AlertTriangleIcon size={12} />
        {vacant}석 미배정
      </span>
    );
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">
      <span className="h-1.5 w-1.5 rounded-full bg-ember-600" />
      배정 완료
    </span>
  );
}
