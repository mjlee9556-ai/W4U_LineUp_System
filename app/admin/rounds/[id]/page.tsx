import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getMemberNames, withDays } from "@/lib/queries";
import { buildLineup, groupBySession } from "@/lib/lineup";
import { formatMonth, formatShort } from "@/lib/dates";
import { SESSION_LABELS, SESSION_SHORT, SIGNUP_SESSIONS } from "@/lib/sessions";
import { canServe, hasSaturdayPractice, type Assignment, type Availability, type Guest, type LineupEvent, type Member, type Round } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Notice } from "@/components/Notice";
import { ServeCountTable } from "@/components/ServeCountTable";
import { SubmitButton } from "@/components/SubmitButton";
import { autoAssignRound, confirmRound, deleteRound, setRoundStatus, toggleSaturdayPractice } from "../../actions";

const SAVED: Record<string, string> = {
  auto: "자동 배정했어요. 아래 '주별 배정'에서 확인하고, 고칠 주는 '편성하기'에서 바꿔 주세요.",
  confirm: "편성 중이던 주를 모두 확정했어요. 팀원 캘린더에 바로 보여요.",
};

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
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
  const draftCount = events.filter((e) => e.lineup_status === "draft").length;

  const responded = new Set(answers.map((a) => a.member_id));
  const missing = members.filter((m) => !responded.has(m.id));
  const confirmedCount = events.filter((e) => e.lineup_status === "confirmed").length;
  const roundLabel = formatMonth(round.target_month.slice(0, 7));
  const deleteMessage = [
    `${roundLabel} 회차를 삭제할까요?`,
    `함께 지워지는 것: 주일 일정 ${events.length}개, 팀원 응답 ${answers.length}건${confirmedCount ? `, 확정된 라인업 ${confirmedCount}개 (캘린더에서도 사라져요)` : ""}`,
    "삭제하면 되돌릴 수 없어요.",
  ].join("\n\n");

  return (
    <AppShell member={member}>
      <Link href="/admin" className="text-sm text-stone-500 hover:underline">← 관리</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">{formatMonth(round.target_month.slice(0, 7))} 응답 현황</h1>
        <form action={setRoundStatus}>
          <input type="hidden" name="round_id" value={round.id} />
          <input type="hidden" name="status" value={round.status === "open" ? "closed" : "open"} />
          <SubmitButton className="btn-secondary" pendingText="…">{round.status === "open" ? "수집 마감" : "다시 열기"}</SubmitButton>
        </form>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {round.status === "open" ? "수집 중" : "마감됨"} · 응답 {responded.size}/{members.length}명
        {round.closes_at && ` · ${formatShort(round.closes_at.slice(0, 10))} 마감`}
      </p>

      <div className="mt-4">
        <Notice message={saved ? SAVED[saved] : undefined} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-center text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-2 py-2 text-left">주일</th>
              {SIGNUP_SESSIONS.map((s) => (
                <th key={s} className="px-2 py-2 font-normal">{SESSION_SHORT[s]}</th>
              ))}
              <th className="px-2 py-2 font-normal">토 불가</th>
              <th className="px-2 py-2 font-normal">토 연습</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {events.map((e) => {
              const answered = answers.filter((a) => a.event_id === e.id);
              const available = answered.filter((a) => canServe(a.status, e));
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-2 py-2 text-left">{formatShort(e.end_date)}</td>
                  {SIGNUP_SESSIONS.map((s) => {
                    const count = available.filter((a) => a.sessions.includes(s)).length;
                    return (
                      <td key={s} className={`px-2 py-2 ${count === 0 ? "text-stone-300" : ""}`}>{count}</td>
                    );
                  })}
                  <td className="px-2 py-2 text-stone-500">{answered.filter((a) => a.status === "sun_only").length}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {e.lineup_status === "draft" ? (
                      <form action={toggleSaturdayPractice}>
                        <input type="hidden" name="event_id" value={e.id} />
                        <SubmitButton
                          pendingText="…"
                          className={`rounded-full border px-2 py-0.5 text-xs ${hasSaturdayPractice(e) ? "border-stone-300 text-stone-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}
                          title={hasSaturdayPractice(e) ? "누르면 이 주는 토 연습 없음" : "누르면 토 연습을 다시 넣어요"}
                        >
                          {hasSaturdayPractice(e) ? "있음" : "없음"}
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs text-stone-500">{hasSaturdayPractice(e) ? "있음" : "없음"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <Link href={`/admin/events/${e.id}`} className="text-xs underline-offset-2 hover:underline">
                      {e.lineup_status === "confirmed" ? "확정됨 · 보기" : "편성하기"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        숫자는 세션별로 편성할 수 있는 인원이에요 (토 연습이 있는 주의 &apos;토 불가&apos;는 빼고 세요). 가능한 사람이 없는 세션은 편성 화면에서 게스트를 넣을 수 있어요. 토요일 연습이 없는 주는 &apos;토 연습&apos; 칸을 눌러 &apos;없음&apos;으로 바꾸면,
        팀원은 그 주를 가능/불가로만 답해요.
      </p>

      <section className="card mt-6">
        <h2 className="font-semibold">자동 배정</h2>
        <p className="mt-1 text-sm text-stone-600">
          파트마다 가능하다고 답한 주에만, 한 달 섬김 횟수가 고르게 되도록 나눠 넣어요. &apos;토 불가&apos;인 사람은 토 연습이 없는 주에만 넣어요. 한 사람은 한 주에 한 파트만 넣어요.
          확정된 주는 바꾸지 않고 횟수에만 셈해요.
        </p>
        <form action={autoAssignRound} className="mt-3">
          <input type="hidden" name="round_id" value={round.id} />
          <div className="label">파트별 한 주 인원</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {SIGNUP_SESSIONS.map((s) => (
              <label key={s} className="text-xs text-stone-600">
                {SESSION_LABELS[s]}
                <input name={`count:${s}`} type="number" min={0} max={5} defaultValue={1} className="input mt-1 px-2 py-1 text-center" />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">0으로 두면 그 파트는 비워 둬요 (직접 넣거나 게스트로).</p>
          <div className="mt-3">
            {draftCount ? (
              <ConfirmSubmitButton
                confirmMessage={`편성 중인 ${draftCount}주의 팀원 배정을 자동으로 새로 채울까요?\n\n직접 고친 배정도 다시 정해져요. 확정된 주와 게스트는 그대로예요.`}
                pendingText="배정 중…"
                className="btn-primary"
              >
                자동 배정하기
              </ConfirmSubmitButton>
            ) : (
              <p className="text-sm text-stone-500">편성 중인 주가 없어요. 바꾸려면 그 주의 확정을 먼저 풀어 주세요.</p>
            )}
          </div>
        </form>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">주별 배정</h2>
          {draftCount > 0 && (
            <form action={confirmRound}>
              <input type="hidden" name="round_id" value={round.id} />
              <ConfirmSubmitButton
                confirmMessage={`편성 중인 ${draftCount}주를 모두 확정하고 팀원에게 공개할까요?`}
                pendingText="확정 중…"
                className="btn-secondary"
              >
                모두 확정하고 공개
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-2 py-2 text-left font-normal">주일</th>
                <th className="px-2 py-2 text-left font-normal">배정</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 align-top">
              {events.map((e) => {
                const groups = groupBySession(lineups.get(e.id) ?? []);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-2 py-2">
                      {formatShort(e.end_date)}
                      <div className={`text-xs ${e.lineup_status === "confirmed" ? "text-emerald-700" : "text-stone-500"}`}>
                        {e.lineup_status === "confirmed" ? "확정" : "편성 중"}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {groups.length === 0 ? (
                        <span className="text-stone-400">아직 없어요</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {groups.map((g) => (
                            <span key={g.session} className="whitespace-nowrap">
                              <span className="text-xs text-stone-400">{SESSION_SHORT[g.session]} </span>
                              {g.entries.map((x) => `${x.name}${x.guest ? "(G)" : ""}${x.satAbsent ? "(토✕)" : ""}`).join(", ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Link href={`/admin/events/${e.id}`} className="text-xs underline-offset-2 hover:underline">
                        {e.lineup_status === "confirmed" ? "보기" : "편성하기"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">파트별 섬김 횟수</h2>
        <p className="mt-1 text-xs text-stone-500">칸은 &apos;배정된 횟수 / 가능하다고 답한 주 수&apos;예요. 게스트는 세지 않아요.</p>
        <div className="mt-3">
          <ServeCountTable members={members} assignments={assignments} availableWeeks={availableWeeks} />
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">미제출 {missing.length}명</h2>
        <p className="mt-2 text-sm text-stone-700">{missing.map((m) => m.name).join(", ") || "모두 제출했어요."}</p>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">회차 삭제</h2>
        <p className="mt-2 text-sm text-stone-600">
          이 달의 주일 일정과 팀원 응답, 라인업이 모두 함께 지워지고 되돌릴 수 없어요.
        </p>
        <form action={deleteRound} className="mt-3">
          <input type="hidden" name="round_id" value={round.id} />
          <ConfirmSubmitButton
            confirmMessage={deleteMessage}
            pendingText="삭제 중…"
            className="btn border border-red-300 bg-white text-red-700 hover:bg-red-50"
          >
            {roundLabel} 회차 삭제
          </ConfirmSubmitButton>
        </form>
      </section>
    </AppShell>
  );
}
