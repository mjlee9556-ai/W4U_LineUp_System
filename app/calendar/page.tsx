import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getEventsBetween, getMemberNames } from "@/lib/queries";
import { calendarGrid, formatMonth, formatShort, isCommunionSunday, isValidMonth, parseISODate, shiftMonth, todayKST, WEEKDAYS } from "@/lib/dates";
import { buildLineup, groupBySession, practiceDates, serviceDates, type LineupEntry } from "@/lib/lineup";
import { SESSION_LABELS, SESSION_SHORT } from "@/lib/sessions";
import { DEFAULT_COMMUNION_NOTICE, getSetlists, getSetting, type SetlistSong } from "@/lib/setlist";
import { EVENT_TYPE_LABELS, type Assignment, type Guest, type LineupEvent } from "@/lib/types";
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
  const confirmedIds = confirmed.map((e) => e.id);
  const [assignments, guests] = await Promise.all([
    query<Assignment>(`select * from lineup_assignments where event_id = any($1::uuid[])`, [confirmedIds]),
    query<Guest>(`select * from lineup_guests where event_id = any($1::uuid[]) order by name`, [confirmedIds]),
  ]);
  const [names, setlists, communionNotice] = await Promise.all([
    getMemberNames(assignments.map((a) => a.member_id)),
    getSetlists(confirmedIds),
    getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE),
  ]);

  const lineupByEvent = new Map<string, LineupEntry[]>();
  for (const e of confirmed) {
    lineupByEvent.set(
      e.id,
      buildLineup(
        assignments.filter((a) => a.event_id === e.id),
        names,
        guests.filter((g) => g.event_id === e.id),
      ),
    );
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

  // 이 달에 내가 섬기는 날짜와 세션
  const myServices = monthServices
    .map(({ date, event }) => ({
      date,
      sessions: (lineupByEvent.get(event.id) ?? []).filter((l) => l.memberId === member.id).map((l) => SESSION_LABELS[l.session]),
    }))
    .filter((x) => x.sessions.length > 0);

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

      {myServices.length > 0 && (
        <section className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <h2 className="text-sm font-semibold text-amber-900">⭐ 이번 달 내 섬김</h2>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-900">
            {myServices.map((s) => (
              <li key={s.date}>
                <span className="font-semibold">{formatShort(s.date)}</span> {s.sessions.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

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
                className={`relative min-h-16 border-b border-r border-stone-100 p-1 md:min-h-28 ${
                  mine ? "bg-amber-100 ring-2 ring-inset ring-amber-400" : inMonth ? "" : "bg-stone-50 text-stone-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`text-xs ${date === today ? "inline-block rounded-full bg-stone-900 px-1.5 text-white" : ""}`}>
                    {parseISODate(date).getUTCDate()}
                  </span>
                  {isCommunionSunday(date) && (
                    <span title="성찬식" aria-label="성찬식">
                      <span className="text-[10px] md:hidden">🕊️</span>
                      <span className="hidden rounded bg-stone-700 px-1 text-[10px] leading-tight text-white md:inline">성찬식</span>
                    </span>
                  )}
                </div>
                {mine && (
                  <span className="absolute right-0.5 top-0.5 text-sm leading-none" title="내 섬김" aria-label="내 섬김">
                    ⭐
                  </span>
                )}
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
          <LineupCard
            key={`${event.id}-${date}`}
            date={date}
            event={event}
            lineup={lineupByEvent.get(event.id)}
            songs={setlists.get(event.id)}
            myId={member.id}
            communionNotice={communionNotice}
          />
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
              <span key={e.key} className={e.memberId === myId ? "font-semibold text-amber-700" : e.guest ? "text-stone-500" : ""}>
                {i > 0 && ", "}
                {e.name}
                {e.guest && "(G)"}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineupCard({
  date,
  event,
  lineup,
  songs,
  myId,
  communionNotice,
}: {
  date: string;
  event: LineupEvent;
  lineup?: LineupEntry[];
  songs?: SetlistSong[];
  myId: string;
  communionNotice: string;
}) {
  const practice = practiceDates(event);
  const communion = isCommunionSunday(date);
  const mine = event.lineup_status === "confirmed" && !!lineup?.some((l) => l.memberId === myId);
  return (
    <section className={`card ${mine ? "border-2 border-amber-400 bg-amber-50" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {formatShort(date)}
          {event.type !== "weekend" && <span className="ml-2 text-sm font-normal text-violet-700">{event.title}</span>}
          {communion && <span className="ml-2 rounded-full bg-stone-800 px-2 py-0.5 text-xs font-semibold text-white">성찬식</span>}
          {mine && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">⭐ 내 섬김</span>}
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
                  <span key={e.key}>
                    {i > 0 && ", "}
                    <span className={e.memberId === myId ? "font-semibold text-amber-700" : ""}>{e.name}</span>
                    {e.guest && <span className="ml-1 rounded bg-stone-100 px-1 text-xs text-stone-600">게스트</span>}
                    {e.satAbsent && <span className="ml-1 rounded bg-red-50 px-1 text-xs text-red-700">토 불참</span>}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {communion && <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-800">🕊️ {communionNotice}</p>}
      {songs && songs.length > 0 && (
        <ol className="mt-3 list-inside list-decimal space-y-0.5 border-t border-stone-100 pt-3 text-sm">
          {songs.map((s) => (
            <li key={s.id}>
              {s.title}
              {s.song_key && <span className="ml-1 text-xs text-amber-800">{s.song_key}</span>}
            </li>
          ))}
        </ol>
      )}
      <Link href={`/events/${event.id}`} className="mt-3 inline-block text-sm font-medium text-stone-700 underline-offset-2 hover:underline">
        {songs?.length ? "콘티·악보 보기 →" : "주차 상세 · 콘티 →"}
      </Link>
    </section>
  );
}
