import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { withDays } from "@/lib/queries";
import { formatShort } from "@/lib/dates";
import { SESSION_LABELS, SESSIONS } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, type Assignment, type Availability, type LineupEvent, type Guest, type Member } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteEvent, saveLineup, unconfirmLineup } from "../../actions";

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
  const { member } = await requireAdmin();

  const found = await queryOne<LineupEvent>(`select * from events where id = $1`, [id]);
  if (!found) notFound();
  const [event] = await withDays([found]);

  const [answerRows, assignments, members, guests] = await Promise.all([
    query<Availability>(`select * from availabilities where event_id = $1`, [id]),
    query<Assignment>(`select * from lineup_assignments where event_id = $1`, [id]),
    query<Pick<Member, "id" | "name">>(`select id, name from members where status = 'approved' order by name`),
    query<Guest>(`select * from lineup_guests where event_id = $1 order by name`, [id]),
  ]);
  const answers = new Map(answerRows.map((a) => [a.member_id, a]));
  const assigned = new Set(assignments.map((a) => `${a.session}:${a.member_id}`));

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
        <p className="text-sm text-stone-600">
          세션마다 인원 제한은 없어요. 가능한 팀원이 없으면 &apos;게스트&apos; 칸에 이름을 적어 넣을 수 있어요.
        </p>
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
            const assignedCount = assignments.filter((a) => a.session === session).length;
            const sessionGuests = guests.filter((g) => g.session === session).map((g) => g.name);
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
                  {assignedCount + sessionGuests.length > 0 && (
                    <span className="text-xs text-stone-500">{assignedCount + sessionGuests.length}명 저장됨</span>
                  )}
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
                <input
                  name={`guests:${session}`}
                  defaultValue={sessionGuests.join(", ")}
                  placeholder="게스트 이름 (팀원이 아닌 경우, 여러 명은 쉼표로)"
                  aria-label={`${SESSION_LABELS[session]} 게스트`}
                  maxLength={100}
                  className="input mt-3"
                />
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

      {event.type !== "weekend" && (
        <section className="card mt-6">
          <h2 className="font-semibold">일정 삭제</h2>
          <p className="mt-2 text-sm text-stone-600">이 일정의 응답과 라인업(게스트 포함)이 함께 지워지고 되돌릴 수 없어요.</p>
          <form action={deleteEvent} className="mt-3">
            <input type="hidden" name="event_id" value={event.id} />
            <ConfirmSubmitButton
              confirmMessage={`'${event.title}' 일정을 삭제할까요?\n\n함께 지워지는 것: 팀원 응답 ${answerRows.length}건, 라인업${confirmed ? " (확정된 라인업이라 캘린더에서도 사라져요)" : ""}\n\n삭제하면 되돌릴 수 없어요.`}
              pendingText="삭제 중…"
              className="btn border border-red-300 bg-white text-red-700 hover:bg-red-50"
            >
              일정 삭제
            </ConfirmSubmitButton>
          </form>
        </section>
      )}

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
