import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { withDays } from "@/lib/queries";
import { formatMonth, formatShort } from "@/lib/dates";
import { SESSION_LABELS, SESSIONS } from "@/lib/sessions";
import { canServe, EVENT_TYPE_LABELS, type Assignment, type Availability, type Guest, type LineupEvent, type Member } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ServeCountTable } from "@/components/ServeCountTable";
import { SubmitButton } from "@/components/SubmitButton";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChurchIcon,
  FileIcon,
  LightbulbIcon,
  LockIcon,
  PlusIcon,
  TableIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
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
  // 같은 달(회차) 전체 배정: 섬김 횟수 표용
  const monthAssignments = event.round_id
    ? await query<Assignment>(
        `select a.* from lineup_assignments a join events e on e.id = a.event_id where e.round_id = $1`,
        [event.round_id],
      )
    : [];
  const answers = new Map(answerRows.map((a) => [a.member_id, a]));
  const assigned = new Set(assignments.map((a) => `${a.session}:${a.member_id}`));

  const available = members.filter((m) => {
    const a = answers.get(m.id);
    return a && canServe(a.status, event);
  });
  // 토 연습이 있는 주의 '토 불가' 응답자: 이번 주는 편성할 수 없다
  const satBlocked = members.filter((m) => answers.get(m.id)?.status === "sun_only" && !canServe("sun_only", event));
  const confirmed = event.lineup_status === "confirmed";
  const days = (event.event_days ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const peopleCount = new Set(assignments.map((a) => a.member_id)).size + guests.length;
  const backHref = event.round_id ? `/admin/rounds/${event.round_id}` : "/admin";

  return (
    <AppShell
      member={member}
      back={{ href: backHref, label: "응답 현황" }}
      action={
        <Link
          href="/calendar"
          className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-bold text-ink-900 hover:bg-stone-50"
        >
          <ChurchIcon size={15} />
          J4U Worship
        </Link>
      }
    >
      <div className="space-y-4">
        {/* 제목 */}
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-extrabold tracking-tight text-ink-900">
            {event.type === "weekend" ? `${formatShort(event.end_date)} 주일` : event.title} 라인업
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                confirmed ? "bg-sage-50 text-sage-700" : "bg-gold-50 text-gold-700"
              }`}
            >
              {confirmed ? "확정됨" : "편성 중"}
            </span>
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-stone-500">
            <span>
              {EVENT_TYPE_LABELS[event.type]} · {days.map((d) => `${formatShort(d.date)} ${d.kind === "practice" ? "연습" : "예배"}`).join(", ")}
            </span>
            <span className="text-stone-300">|</span>
            <span className="font-bold text-ink-900">배정 {peopleCount}명</span>
            <span className="text-stone-300">|</span>
            <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink-900 hover:underline">
              <FileIcon size={13} />
              콘티·악보 연동
            </Link>
          </p>
        </div>

        <Notice message={saved === "confirm" ? "라인업을 확정했어요. 팀원 캘린더에 바로 보여요." : saved ? "임시 저장했어요." : undefined} />

        {confirmed ? (
          <section className="rounded-2xl border border-sage-200 bg-sage-50 p-4">
            <p className="flex items-start gap-2 text-sm text-sage-700">
              <LockIcon size={16} className="mt-0.5 shrink-0" />
              확정된 라인업은 팀원 캘린더에 공개돼 있어요. 고치려면 확정을 풀어 주세요.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href={`/calendar?month=${event.end_date.slice(0, 7)}`} className="btn-secondary">
                캘린더에서 보기
              </Link>
              <form action={unconfirmLineup}>
                <input type="hidden" name="event_id" value={event.id} />
                <SubmitButton className="btn-secondary" pendingText="…">확정 풀기</SubmitButton>
              </form>
            </div>
          </section>
        ) : (
          <p className="flex items-start gap-2.5 rounded-2xl border border-stone-200 bg-stone-100/70 px-4 py-3 text-[13px] leading-relaxed text-stone-600">
            <LightbulbIcon size={18} className="mt-0.5 shrink-0 text-gold-500" />
            <span>
              세션마다 인원 제한은 없어요. 가능한 팀원이 없으면 <b className="text-ink-900">&apos;게스트&apos;</b> 칸에 이름을 적어 넣을 수 있어요.
            </span>
          </p>
        )}

        <form action={saveLineup} className="space-y-3">
          <input type="hidden" name="event_id" value={event.id} />
          <fieldset disabled={confirmed} className="space-y-3">
            {SESSIONS.map((session) => {
              // 서브 인도자 후보는 인도자로 응답한 사람
              const wants = (m: Pick<Member, "id">) => {
                const s = answers.get(m.id)?.sessions ?? [];
                return s.includes(session === "sub_leader" ? "leader" : session);
              };
              const primary = available.filter(wants);
              const blockedHere = satBlocked.filter(wants);
              const others = available.filter((m) => !wants(m));
              const assignedCount = assignments.filter((a) => a.session === session).length;
              const sessionGuests = guests.filter((g) => g.session === session).map((g) => g.name);
              const savedCount = assignedCount + sessionGuests.length;

              const renderOption = (m: Pick<Member, "id" | "name">) => {
                const a = answers.get(m.id)!;
                return (
                  <label key={m.id} className="group cursor-pointer">
                    <input
                      type="checkbox"
                      name="assign"
                      value={`${session}:${m.id}`}
                      defaultChecked={assigned.has(`${session}:${m.id}`)}
                      className="peer sr-only"
                    />
                    <span
                      title={a.comment ?? undefined}
                      className="inline-flex select-none items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-[13px] font-bold text-ink-900 transition hover:border-stone-300 peer-checked:border-ink-900 peer-checked:bg-ink-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ink-900/30"
                    >
                      {m.name}
                      {a.comment && <span className="text-xs opacity-70">💬</span>}
                      <PlusIcon size={13} strokeWidth={2.4} className="text-stone-400 group-has-[:checked]:hidden" />
                      <XIcon size={13} strokeWidth={2.4} className="hidden group-has-[:checked]:block" />
                    </span>
                  </label>
                );
              };

              return (
                <section
                  key={session}
                  className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition has-[:checked]:border-ink-900/25 has-[:checked]:shadow-[0_6px_20px_-6px_rgba(27,36,56,0.18)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-extrabold text-ink-900">{SESSION_LABELS[session]}</h2>
                      {savedCount > 0 && (
                        <span className="rounded-md bg-sage-50 px-1.5 py-0.5 text-[11px] font-bold text-sage-700">배정완료</span>
                      )}
                    </div>
                    <span className={`text-xs ${savedCount ? "font-bold text-ink-900" : "text-stone-400"}`}>
                      {savedCount ? `${savedCount}명 저장됨` : primary.length ? "선택 대기" : "가능한 사람 없음"}
                    </span>
                  </div>

                  {primary.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{primary.map(renderOption)}</div>}

                  {blockedHere.length > 0 && (
                    <p className="mt-2 text-xs text-stone-500">
                      토 불가라 이번 주는 편성할 수 없어요: {blockedHere.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {others.length > 0 && (
                    <details className="mt-2" open={others.some((m) => assigned.has(`${session}:${m.id}`)) || undefined}>
                      <summary className="cursor-pointer text-xs text-stone-500 marker:text-stone-400">
                        다른 세션으로 응답한 가능자 {others.length}명
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">{others.map(renderOption)}</div>
                    </details>
                  )}
                  <input
                    name={`guests:${session}`}
                    defaultValue={sessionGuests.join(", ")}
                    placeholder="게스트 이름 (팀원이 아닌 경우, 여러 명은 쉼표로)"
                    aria-label={`${SESSION_LABELS[session]} 게스트`}
                    maxLength={100}
                    className="mt-3 h-11 w-full min-w-0 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 text-[13px] text-stone-900 placeholder:text-stone-400 focus:border-ink-900 focus:bg-white focus:outline-none"
                  />
                </section>
              );
            })}
          </fieldset>

          {!confirmed && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <SubmitButton
                name="intent"
                value="save"
                className="flex h-13 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-[15px] font-bold text-ink-900 shadow-sm hover:bg-stone-50 disabled:opacity-60"
              >
                <CalendarIcon size={17} />
                임시 저장
              </SubmitButton>
              <SubmitButton
                name="intent"
                value="confirm"
                pendingText="확정 중…"
                className="flex h-13 items-center justify-center gap-2 rounded-xl bg-ink-900 text-[15px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(27,36,56,0.35)] hover:bg-navy-800 disabled:opacity-60"
              >
                <CheckCircleIcon size={18} />
                확정하고 공개
              </SubmitButton>
            </div>
          )}
        </form>

        {event.round_id && (
          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink-900">
                <TableIcon size={16} />
                이번 달 섬김 횟수
              </h2>
              <span className="text-xs text-stone-400">{formatMonth(event.end_date.slice(0, 7)).split(" ")[1]} 기준</span>
            </div>
            <ServeCountTable members={members} assignments={monthAssignments} />
            <p className="mt-2 text-[11px] text-stone-400">저장된 배정 기준이에요. 고친 뒤 &apos;임시 저장&apos;을 누르면 바로 반영돼요.</p>
          </section>
        )}

        <section className="panel">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink-900">
              <CalendarIcon size={16} />
              응답 목록
            </h2>
            <span className="text-xs text-stone-400">총 {answerRows.length}명 제출</span>
          </div>
          <ul className="divide-y divide-stone-100 text-sm">
            {members.map((m) => {
              const a = answers.get(m.id);
              const badge = !a
                ? { text: "미제출", tone: "bg-stone-100 text-stone-500" }
                : a.status === "none"
                  ? { text: "불참", tone: "bg-red-50 text-red-600" }
                  : { text: "참석", tone: "bg-sage-50 text-sage-700" };
              const detail = !a
                ? ""
                : a.status === "none"
                  ? (a.comment ?? "")
                  : [`${STATUS_LABEL[a.status]} · ${a.sessions.map((s) => SESSION_LABELS[s]).join(", ")}`, a.comment].filter(Boolean).join(" · ");
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-ink-900">{m.name}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>
                  </span>
                  <span className="truncate text-right text-xs text-stone-500">{detail}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {event.type !== "weekend" && (
          <section className="rounded-2xl border border-red-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-red-700">
              <AlertTriangleIcon size={18} />
              일정 삭제
            </h2>
            <p className="mb-4 mt-2 text-[13px] text-stone-600">이 일정의 응답과 라인업(게스트 포함)이 함께 지워지고 되돌릴 수 없어요.</p>
            <form action={deleteEvent}>
              <input type="hidden" name="event_id" value={event.id} />
              <ConfirmSubmitButton
                confirmMessage={`'${event.title}' 일정을 삭제할까요?\n\n함께 지워지는 것: 팀원 응답 ${answerRows.length}건, 라인업${confirmed ? " (확정된 라인업이라 캘린더에서도 사라져요)" : ""}\n\n삭제하면 되돌릴 수 없어요.`}
                pendingText="삭제 중…"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-600 px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <TrashIcon size={16} />
                일정 삭제
              </ConfirmSubmitButton>
            </form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
