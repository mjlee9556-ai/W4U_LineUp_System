import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { withDays } from "@/lib/queries";
import { formatMonth, formatShort } from "@/lib/dates";
import { SESSION_SHORT, SIGNUP_SESSIONS } from "@/lib/sessions";
import { hasSaturdayPractice, type Availability, type LineupEvent, type Member, type Round, type SessionRule } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteRound, setRoundStatus, toggleSaturdayPractice } from "../../actions";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await requireAdmin();

  const round = await queryOne<Round>(`select * from availability_rounds where id = $1`, [id]);
  if (!round) notFound();

  const [events, answers, members, ruleRows] = await Promise.all([
    query<LineupEvent>(`select * from events where round_id = $1 order by start_date`, [id]).then(withDays),
    query<Availability>(
      `select a.* from availabilities a join events e on e.id = a.event_id where e.round_id = $1`,
      [id],
    ),
    query<Pick<Member, "id" | "name">>(`select id, name from members where status = 'approved' order by name`),
    query<SessionRule>(`select * from session_rules`),
  ]);
  const rules = new Map(ruleRows.map((r) => [r.session, r]));

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

      <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
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
              const available = answers.filter((a) => a.event_id === e.id && a.status !== "none");
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-2 py-2 text-left">{formatShort(e.end_date)}</td>
                  {SIGNUP_SESSIONS.map((s) => {
                    const count = available.filter((a) => a.sessions.includes(s)).length;
                    const short = count < (rules.get(s)?.min ?? 0);
                    return (
                      <td key={s} className={`px-2 py-2 ${short ? "bg-red-50 font-semibold text-red-700" : ""}`}>{count}</td>
                    );
                  })}
                  <td className="px-2 py-2 text-stone-500">{available.filter((a) => a.status === "sun_only").length}</td>
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
        숫자는 세션별 가능 인원이에요. 빨간 칸은 정원보다 적어요. 토요일 연습이 없는 주는 &apos;토 연습&apos; 칸을 눌러 &apos;없음&apos;으로 바꾸면,
        팀원은 그 주를 가능/불가로만 답해요.
      </p>

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
