import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatMonth, formatShort } from "@/lib/dates";
import { SESSION_SHORT, SIGNUP_SESSIONS } from "@/lib/sessions";
import type { Availability, LineupEvent, Member, Round, SessionRule } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { setRoundStatus } from "../../actions";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, member } = await requireAdmin();

  const { data: round } = await supabase.from("availability_rounds").select("*").eq("id", id).maybeSingle<Round>();
  if (!round) notFound();

  const { data: eventRows } = await supabase.from("events").select("*").eq("round_id", id).order("start_date");
  const events = (eventRows ?? []) as LineupEvent[];
  const eventIds = events.map((e) => e.id);

  const [{ data: answerRows }, { data: memberRows }, { data: ruleRows }] = await Promise.all([
    eventIds.length ? supabase.from("availabilities").select("*").in("event_id", eventIds) : Promise.resolve({ data: [] }),
    supabase.from("members").select("id, name").eq("status", "approved").order("name"),
    supabase.from("session_rules").select("*"),
  ]);
  const answers = (answerRows ?? []) as Availability[];
  const members = (memberRows ?? []) as Pick<Member, "id" | "name">[];
  const rules = new Map(((ruleRows ?? []) as SessionRule[]).map((r) => [r.session, r]));

  const responded = new Set(answers.map((a) => a.member_id));
  const missing = members.filter((m) => !responded.has(m.id));

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
      <p className="mt-2 text-xs text-stone-500">숫자는 세션별 가능 인원이에요. 빨간 칸은 정원보다 적어요.</p>

      <section className="card mt-6">
        <h2 className="font-semibold">미제출 {missing.length}명</h2>
        <p className="mt-2 text-sm text-stone-700">{missing.map((m) => m.name).join(", ") || "모두 제출했어요."}</p>
      </section>
    </AppShell>
  );
}
