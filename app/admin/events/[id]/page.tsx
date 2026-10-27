import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatShort } from "@/lib/dates";
import { capacityWarnings } from "@/lib/lineup";
import { SESSION_LABELS, SESSIONS, type Session } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, type Assignment, type Availability, type LineupEvent, type Member, type SessionRule } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { saveLineup, unconfirmLineup } from "../../actions";

const STATUS_LABEL = { both: "토·일", sun_only: "토 불가", available: "가능", none: "불가" } as const;

export default async function EventLineupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase, member } = await requireAdmin();

  const { data: event } = await supabase.from("events").select("*, event_days(*)").eq("id", id).maybeSingle<LineupEvent>();
  if (!event) notFound();

  const [{ data: answerRows }, { data: assignmentRows }, { data: memberRows }, { data: ruleRows }] = await Promise.all([
    supabase.from("availabilities").select("*").eq("event_id", id),
    supabase.from("lineup_assignments").select("*").eq("event_id", id),
    supabase.from("members").select("id, name").eq("status", "approved").order("name"),
    supabase.from("session_rules").select("*"),
  ]);
  const answers = new Map(((answerRows ?? []) as Availability[]).map((a) => [a.member_id, a]));
  const assignments = (assignmentRows ?? []) as Assignment[];
  const assigned = new Set(assignments.map((a) => `${a.session}:${a.member_id}`));
  const members = (memberRows ?? []) as Pick<Member, "id" | "name">[];
  const rules = (ruleRows ?? []) as SessionRule[];
  const ruleBySession = new Map(rules.map((r) => [r.session, r]));

  const counts: Partial<Record<Session, number>> = {};
  for (const a of assignments) counts[a.session] = (counts[a.session] ?? 0) + 1;
  const warnings = capacityWarnings(counts, rules);

  const available = members.filter((m) => {
    const a = answers.get(m.id);
    return a && a.status !== "none";
  });
  const confirmed = event.lineup_status === "confirmed";
  const days = (event.event_days ?? []).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AppShell member={member}>
      <Link href={event.round_id ? `/admin/rounds/${event.round_id}` : "/admin"} className="text-sm text-stone-500 hover:underline">
        ← 응답 현황
      </Link>
      <h1 className="mt-2 text-xl font-bold">
        {event.type === "weekend" ? `${formatShort(event.end_date)} 주일` : event.title} 라인업
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        {EVENT_TYPE_LABELS[event.type]} · {days.map((d) => `${formatShort(d.date)} ${d.kind === "practice" ? "연습" : "예배"}`).join(", ")}
        {" · "}
        {confirmed ? "확정됨" : "편성 중"} · 가능 {available.length}명
      </p>

      <div className="mt-4">
        <Notice message={saved === "confirm" ? "라인업을 확정했어요. 팀원 캘린더에 바로 보여요." : saved ? "임시 저장했어요." : undefined} />
      </div>

      {confirmed ? (
        <div className="card">
          <p className="text-sm">확정된 라인업은 팀원 캘린더에 공개돼 있어요. 고치려면 확정을 풀어 주세요.</p>
          <div className="mt-3 flex gap-2">
            <Link href={`/calendar?month=${event.end_date.slice(0, 7)}`} className="btn-secondary">캘린더에서 보기</Link>
            <form action={unconfirmLineup}>
              <input type="hidden" name="event_id" value={event.id} />
              <SubmitButton className="btn-secondary" pendingText="…">확정 풀기</SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <>
          {warnings.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {warnings.map((w) => (
                <li key={w.session}>
                  {SESSION_LABELS[w.session]}: {w.count}명 배정 (정원 {w.rule.min}
                  {w.rule.max !== w.rule.min ? `~${w.rule.max ?? "∞"}` : ""}명)
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <form action={saveLineup} className="mt-3 space-y-3">
        <input type="hidden" name="event_id" value={event.id} />
        <fieldset disabled={confirmed} className="space-y-3">
          {SESSIONS.map((session) => {
            // 서브 인도자 후보는 인도자로 응답한 사람
            const wants = (m: Pick<Member, "id">) => {
              const s = answers.get(m.id)?.sessions ?? [];
              return s.includes(session === "sub_leader" ? "leader" : session);
            };
            const primary = available.filter(wants);
            const others = available.filter((m) => !wants(m));
            const rule = ruleBySession.get(session);
            const renderOption = (m: Pick<Member, "id" | "name">) => {
              const a = answers.get(m.id)!;
              return (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    name="assign"
                    value={`${session}:${m.id}`}
                    defaultChecked={assigned.has(`${session}:${m.id}`)}
                    className="peer sr-only"
                  />
                  <span className="chip" title={a.comment ?? undefined}>
                    {m.name}
                    {a.status === "sun_only" && <span className="ml-1 text-xs opacity-70">토 불가</span>}
                    {a.comment && <span className="ml-1 text-xs opacity-70">💬</span>}
                  </span>
                </label>
              );
            };
            return (
              <section key={session} className="card">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">{SESSION_LABELS[session]}</h2>
                  <span className="text-xs text-stone-500">
                    정원 {rule ? `${rule.min}${rule.max !== rule.min ? `~${rule.max ?? "∞"}` : ""}` : "-"}명
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {primary.length ? primary.map(renderOption) : <span className="text-sm text-stone-400">가능한 사람이 없어요</span>}
                </div>
                {others.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-stone-500">다른 세션으로 응답한 가능자 {others.length}명</summary>
                    <div className="mt-2 flex flex-wrap gap-2">{others.map(renderOption)}</div>
                  </details>
                )}
              </section>
            );
          })}
        </fieldset>

        {!confirmed && (
          <div className="sticky bottom-4 flex gap-2">
            <SubmitButton name="intent" value="save" className="btn-secondary flex-1 py-3 shadow-lg">임시 저장</SubmitButton>
            <SubmitButton name="intent" value="confirm" className="btn-primary flex-1 py-3 shadow-lg" pendingText="확정 중…">
              확정하고 공개
            </SubmitButton>
          </div>
        )}
      </form>

      <section className="card mt-6">
        <h2 className="font-semibold">응답 목록</h2>
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {members.map((m) => {
            const a = answers.get(m.id);
            return (
              <li key={m.id} className="flex justify-between gap-2 py-1.5">
                <span>{m.name}</span>
                <span className="text-right text-xs text-stone-500">
                  {a ? STATUS_LABEL[a.status] : "미제출"}
                  {a && a.status !== "none" && ` · ${a.sessions.map((s) => SESSION_LABELS[s]).join(", ")}`}
                  {a?.comment && ` · ${a.comment}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}
