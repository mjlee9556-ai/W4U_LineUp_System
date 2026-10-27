import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getEventsBetween, getMemberNames } from "@/lib/queries";
import { calendarGrid, formatMonth, formatShort, isValidMonth, parseISODate, shiftMonth, todayKST, WEEKDAYS } from "@/lib/dates";
import { buildLineup, groupBySession, practiceDates, serviceDates, type LineupEntry } from "@/lib/lineup";
import { SESSION_LABELS, SESSION_SHORT } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, type Assignment, type LineupEvent } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

type DayItem =
  | { kind: "service"; event: LineupEvent; lineup: LineupEntry[] }
  | { kind: "practice"; event: LineupEvent };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { member } = await requireMember();
  const params = await searchParams;
  const today = todayKST();
  const month = isValidMonth(params.month) ? params.month : today.slice(0, 7);

  const grid = calendarGrid(month);
  const events = await getEventsBetween(grid[0].date, grid.at(-1)!.date);
  const confirmed = events.filter((e) => e.lineup_status === "confirmed");

  // 확정된 일정의 배정만 공개
  const assignments = await query<Assignment>(`select * from lineup_assignments where event_id = any($1::uuid[])`, [
    confirmed.map((e) => e.id),
  ]);
  const names = await getMemberNames(assignments.map((a) => a.member_id));

  const lineupByEvent = new Map<string, LineupEntry[]>();
  for (const e of confirmed) {
    lineupByEvent.set(e.id, buildLineup(assignments.filter((a) => a.event_id === e.id), names));
  }

  // 날짜 → 그날 표시할 항목
  const byDate = new Map<string, DayItem[]>();
  const push = (date: string, item: DayItem) => byDate.set(date, [...(byDate.get(date) ?? []), item]);
  for (const e of events) {
    for (const d of practiceDates(e)) push(d, { kind: "practice", event: e });
    for (const d of serviceDates(e)) push(d, { kind: "service", event: e, lineup: lineupByEvent.get(e.id) ?? [] });
  }

  const monthServices = events
    .flatMap((e) => serviceDates(e).map((date) => ({ date, event: e })))
    .filter((x) => x.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AppShell member={member}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{formatMonth(month)} 라인업</h1>
        <div className="flex gap-1 text-sm">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className="btn-secondary px-3 py-1.5" aria-label="이전 달">‹</Link>
          <Link href="/calendar" className="btn-secondary px-3 py-1.5">오늘</Link>
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className="btn-secondary px-3 py-1.5" aria-label="다음 달">›</Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`py-2 ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : ""}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map(({ date, inMonth }) => {
            const items = byDate.get(date) ?? [];
            const mine = items.some((it) => it.kind === "service" && it.lineup.some((l) => l.memberId === member.id));
            return (
              <div
                key={date}
                className={`min-h-16 border-b border-r border-stone-100 p-1 md:min-h-28 ${inMonth ? "" : "bg-stone-50 text-stone-400"} ${mine ? "bg-amber-50" : ""}`}
              >
                <div className={`text-xs ${date === today ? "inline-block rounded-full bg-stone-900 px-1.5 text-white" : ""}`}>
                  {parseISODate(date).getUTCDate()}
                </div>
                {items.map((item, idx) =>
                  item.kind === "practice" ? (
                    <div key={idx} className="mt-0.5 truncate text-[10px] text-stone-500">연습</div>
                  ) : (
                    <CalendarCell key={idx} event={item.event} lineup={item.lineup} myId={member.id} />
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mt-8 font-semibold">날짜별 라인업</h2>
      {monthServices.length === 0 && <p className="mt-2 text-sm text-stone-500">이 달에 등록된 일정이 없어요.</p>}
      <div className="mt-3 space-y-3">
        {monthServices.map(({ date, event }) => (
          <LineupCard key={`${event.id}-${date}`} date={date} event={event} lineup={lineupByEvent.get(event.id)} myId={member.id} />
        ))}
      </div>
    </AppShell>
  );
}

function CalendarCell({ event, lineup, myId }: { event: LineupEvent; lineup: LineupEntry[]; myId: string }) {
  const label = event.type === "weekend" ? null : event.title;
  if (event.lineup_status !== "confirmed") {
    return (
      <div className="mt-0.5 truncate rounded bg-stone-100 px-1 text-[10px] text-stone-500">{label ?? "편성 중"}</div>
    );
  }
  return (
    <div className="mt-0.5">
      {label && <div className="truncate rounded bg-violet-100 px-1 text-[10px] text-violet-800">{label}</div>}
      {/* 좁은 화면에서는 확정 표시만, 넓은 화면에서는 세션별 이름 */}
      <div className="rounded bg-emerald-100 px-1 text-center text-[10px] text-emerald-800 md:hidden">확정</div>
      <ul className="hidden space-y-px text-[11px] leading-tight md:block">
        {groupBySession(lineup).map((g) => (
          <li key={g.session} className="truncate">
            <span className="text-stone-400">{SESSION_SHORT[g.session]} </span>
            {g.entries.map((e, i) => (
              <span key={e.memberId} className={e.memberId === myId ? "font-semibold text-amber-700" : ""}>
                {i > 0 && ", "}
                {e.name}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineupCard({ date, event, lineup, myId }: { date: string; event: LineupEvent; lineup?: LineupEntry[]; myId: string }) {
  const practice = practiceDates(event);
  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {formatShort(date)}
          {event.type !== "weekend" && <span className="ml-2 text-sm font-normal text-violet-700">{event.title}</span>}
        </h3>
        <span className="text-xs text-stone-500">
          {event.type === "weekend" ? EVENT_TYPE_LABELS.weekend : EVENT_TYPE_LABELS[event.type]}
          {practice.length > 0 && ` · 연습 ${practice.map(formatShort).join(", ")}`}
        </span>
      </div>
      {event.lineup_status !== "confirmed" || !lineup ? (
        <p className="mt-2 text-sm text-stone-500">아직 라인업을 편성하고 있어요.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          {groupBySession(lineup).map((g) => (
            <div key={g.session} className="contents">
              <dt className="text-stone-500">{SESSION_LABELS[g.session]}</dt>
              <dd>
                {g.entries.map((e, i) => (
                  <span key={e.memberId}>
                    {i > 0 && ", "}
                    <span className={e.memberId === myId ? "font-semibold text-amber-700" : ""}>{e.name}</span>
                    {e.satAbsent && <span className="ml-1 rounded bg-red-50 px-1 text-xs text-red-700">토 불참</span>}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
