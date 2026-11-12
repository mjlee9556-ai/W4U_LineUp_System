import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getEventsBetween, getOpenEvents } from "@/lib/queries";
import {
  calendarGrid,
  daysUntil,
  formatMonth,
  formatMonthDay,
  formatShort,
  isCommunionSunday,
  isValidMonth,
  parseISODate,
  shiftMonth,
  todayKST,
  weekdayLabel,
  WEEKDAYS,
} from "@/lib/dates";
import { practiceDates, serviceDates, type LineupEntry } from "@/lib/lineup";
import { REQUIRED_SESSIONS, SESSION_LABELS } from "@/lib/sessions";
import { DEFAULT_COMMUNION_NOTICE, getSetlists, getSetting, type SetlistSong } from "@/lib/setlist";
import { EVENT_TYPE_LABELS, type Assignment, type Availability, type LineupEvent } from "@/lib/types";
import { getLineup, getSelectableEvents, mainDate } from "@/lib/week";
import { AppShell } from "@/components/AppShell";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  ListMusicIcon,
  MegaphoneIcon,
  SendIcon,
  StarIcon,
} from "@/components/icons";

type Service = { date: string; event: LineupEvent };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const { member } = await requireMember();
  const params = await searchParams;
  const today = todayKST();
  const month = isValidMonth(params.month) ? params.month : (params.date?.slice(0, 7) ?? today.slice(0, 7));

  const grid = calendarGrid(month);
  const events = await getEventsBetween(grid[0].date, grid.at(-1)!.date);
  const confirmedIds = events.filter((e) => e.lineup_status === "confirmed").map((e) => e.id);
  const myAssignments = await query<Assignment>(
    `select * from lineup_assignments where member_id = $1 and event_id = any($2::uuid[])`,
    [member.id, confirmedIds],
  );
  const mySessionsByEvent = new Map<string, string[]>();
  for (const a of myAssignments) mySessionsByEvent.set(a.event_id, [...(mySessionsByEvent.get(a.event_id) ?? []), SESSION_LABELS[a.session]]);

  const services: Service[] = events.flatMap((e) => serviceDates(e).map((date) => ({ date, event: e })));
  const practiceSet = new Set(events.flatMap(practiceDates));
  const servicesOn = (date: string) => services.filter((s) => s.date === date);

  // 고른 날짜: 주소의 date → 오늘 일정 → 이 달 다음 일정 → 오늘
  const monthServices = services.filter((s) => s.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const selected =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : servicesOn(today).length && today.startsWith(month)
        ? today
        : (monthServices.find((s) => s.date >= today) ?? monthServices[0])?.date ?? today;
  const selectedServices = servicesOn(selected);

  // 이번 주 라인업 · 콘티: 다가오는 확정 일정
  const confirmedSoon = (await getSelectableEvents({ role: "member" })).find((e) => mainDate(e) >= today);
  const [weekLineup, setlists, open, communionNotice] = await Promise.all([
    confirmedSoon ? getLineup(confirmedSoon.id) : Promise.resolve([] as LineupEntry[]),
    confirmedSoon ? getSetlists([confirmedSoon.id]) : Promise.resolve(new Map<string, SetlistSong[]>()),
    getOpenEvents(),
    getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE),
  ]);
  const songs = confirmedSoon ? (setlists.get(confirmedSoon.id) ?? []) : [];

  const myAnswers = open.events.length
    ? await query<Availability>(`select * from availabilities where member_id = $1 and event_id = any($2::uuid[])`, [
        member.id,
        open.events.map((e) => e.id),
      ])
    : [];
  const deadline = open.rounds.find((r) => r.closes_at)?.closes_at?.slice(0, 10);
  const answerCount = (statuses: string[]) => myAnswers.filter((a) => statuses.includes(a.status)).length;

  return (
    <AppShell member={member}>
      <div className="flex items-end justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
            {member.name}님의 찬양팀 사역
          </span>
          <h1 className="mt-2 text-[24px] font-extrabold tracking-tight text-stone-900">{Number(month.slice(5))}월 사역 캘린더</h1>
        </div>
        <Link href="/calendar" className="mb-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
          오늘
        </Link>
      </div>

      <div className="panel mt-4 flex items-center justify-between px-3 py-2.5">
        <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="이전 달">
          <ChevronLeftIcon size={20} />
        </Link>
        <span className="flex items-center gap-2 text-[17px] font-extrabold text-stone-900">
          <CalendarIcon size={19} className="text-accent-600" />
          {formatMonth(month)}
        </span>
        <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="다음 달">
          <ChevronRightIcon size={20} />
        </Link>
      </div>

      <section className="panel mt-3 px-3">
        <div className="grid grid-cols-7 text-center text-xs font-bold">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-stone-500"}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.map(({ date, inMonth }) => {
            const day = servicesOn(date);
            const mine = day.some((s) => mySessionsByEvent.has(s.event.id));
            const isSel = date === selected;
            const sunday = parseISODate(date).getUTCDay() === 0;
            return (
              <Link
                key={date}
                href={`/calendar?month=${month}&date=${date}`}
                scroll={false}
                className={`relative mx-auto flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[15px] font-semibold ${
                  isSel
                    ? "bg-navy-900 text-white"
                    : date === today
                      ? "ring-2 ring-inset ring-navy-900/20"
                      : ""
                } ${!isSel && !inMonth ? "text-stone-300" : !isSel && sunday ? "text-red-500" : !isSel ? "text-stone-800" : ""}`}
              >
                {parseISODate(date).getUTCDate()}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {day.map((s) => (
                    <span
                      key={s.event.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        mySessionsByEvent.has(s.event.id) ? "bg-violet-500" : s.event.lineup_status === "confirmed" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                  ))}
                  {day.length === 0 && practiceSet.has(date) && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-white/60" : "bg-stone-300"}`} />}
                </span>
                {mine && !isSel && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-600" />}
                {isCommunionSunday(date) && inMonth && <span className="sr-only">성찬식</span>}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-stone-100 pt-3 text-[11px] font-semibold text-stone-500">
          <Legend color="bg-emerald-500" label="라인업 확정" />
          <Legend color="bg-amber-400" label="편성 중" />
          <Legend color="bg-violet-500" label="내 섬김" />
          <Legend color="bg-stone-300" label="토 연습" />
        </div>

        <div className="mt-3 space-y-2 pb-1">
          {selectedServices.length === 0 ? (
            <div className="rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-500">
              {formatMonthDay(selected)}({weekdayLabel(selected)}) · {practiceSet.has(selected) ? "토 연습이 있는 날이에요." : "예배 일정이 없어요."}
            </div>
          ) : (
            selectedServices.map(({ event }) => {
              const mine = mySessionsByEvent.get(event.id);
              const practice = practiceDates(event);
              return (
                <Link key={event.id} href={`/lineup?event=${event.id}`} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-3 hover:bg-stone-100">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[15px] font-bold text-stone-900">
                      <CalendarIcon size={16} className="shrink-0 text-accent-600" />
                      <span className="truncate">
                        {formatMonthDay(selected)}({weekdayLabel(selected)}) · {event.type === "weekend" ? "주일 예배" : event.title}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {isCommunionSunday(selected) && "성찬식 주일 · "}
                      {practice.length ? `토 연습 ${practice.map(formatShort).join(", ")}` : event.type === "weekend" ? "토 연습 없음" : EVENT_TYPE_LABELS[event.type]}
                    </p>
                  </div>
                  {mine ? (
                    <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{mine.join(", ")}</span>
                  ) : event.lineup_status === "confirmed" ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircleIcon size={13} />
                      라인업 확정
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">편성 중</span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </section>

      {open.events.length > 0 && (
        <section className="panel mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white">
                <SendIcon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold text-stone-900">나의 사역 가능 여부 제출</h2>
                <p className="text-xs text-stone-500">
                  {open.rounds.map((r) => formatMonth(r.target_month.slice(0, 7))).join(", ") || "다가오는 일정"} · 일정 {open.events.length}개 중 {myAnswers.length}개 응답
                </p>
              </div>
            </div>
            {deadline && (
              <span className="shrink-0 text-xs font-extrabold text-accent-600">
                {daysUntil(deadline) <= 0 ? "오늘 마감" : `D-${daysUntil(deadline)} 마감`}
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat value={answerCount(["both", "available"])} label="가능" tone="bg-navy-900 text-white" />
            <Stat value={answerCount(["sun_only"])} label="토 불가" tone="border border-stone-200 bg-stone-50 text-stone-800" />
            <Stat value={answerCount(["none"])} label="불가" tone="border border-stone-200 bg-stone-50 text-stone-800" />
          </div>
          <Link
            href="/availability"
            className="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-800 hover:bg-stone-50"
          >
            {myAnswers.length < open.events.length ? `남은 ${open.events.length - myAnswers.length}개 일정 응답하기` : "응답 고치기"}
            <ArrowRightIcon size={16} />
          </Link>
        </section>
      )}

      {confirmedSoon && <WeekLineup event={confirmedSoon} lineup={weekLineup} myId={member.id} />}

      {confirmedSoon && songs.length > 0 && (
        <section className="panel mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                <ListMusicIcon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold text-stone-900">예배 콘티 미리보기</h2>
                <p className="text-xs text-stone-500">{formatShort(mainDate(confirmedSoon))} 찬양 순서 · {songs.length}곡</p>
              </div>
            </div>
            <Link href={`/events/${confirmedSoon.id}`} className="flex shrink-0 items-center gap-1 rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800">
              <FileIcon size={14} />
              악보 열람
            </Link>
          </div>
          <ol className="mt-3 divide-y divide-stone-100">
            {songs.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 font-mono text-[15px] font-bold text-stone-400">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-stone-900">{s.title}</p>
                  {s.song_form && <p className="truncate font-mono text-[11px] text-stone-500">{s.song_form}</p>}
                </div>
                {s.song_key && <span className="shrink-0 rounded-md border border-stone-200 px-2 py-0.5 text-xs font-bold text-stone-700">{s.song_key} Key</span>}
              </li>
            ))}
          </ol>
          <Link href={`/events/${confirmedSoon.id}`} className="mt-1 flex items-center justify-end gap-0.5 text-xs font-semibold text-stone-600 hover:underline">
            콘티 메모 · 음원 확인 <ChevronRightIcon size={14} />
          </Link>
        </section>
      )}

      {confirmedSoon && (confirmedSoon.note || serviceDates(confirmedSoon).some(isCommunionSunday)) && (
        <section className="mt-4 rounded-2xl border border-accent-300/50 bg-accent-50/70 p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
            <MegaphoneIcon size={17} className="text-accent-600" />
            공지사항
          </h2>
          <div className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-stone-700">
            {serviceDates(confirmedSoon).some(isCommunionSunday) && <p>🕊️ {communionNotice}</p>}
            {confirmedSoon.note && <p className="whitespace-pre-line">{confirmedSoon.note}</p>}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`rounded-xl py-2.5 ${tone}`}>
      <div className="text-lg font-extrabold leading-tight">{value}</div>
      <div className="text-xs font-semibold opacity-80">{label}</div>
    </div>
  );
}

function WeekLineup({ event, lineup, myId }: { event: LineupEvent; lineup: LineupEntry[]; myId: string }) {
  const filled = REQUIRED_SESSIONS.filter((s) => lineup.some((e) => e.session === s)).length;
  const voices = lineup.filter((e) => e.session === "leader" || e.session === "sub_leader" || e.session === "vocal");
  const band = lineup.filter((e) => !voices.includes(e));
  const nameClass = (e: LineupEntry) => (e.memberId === myId ? "text-accent-600" : "text-stone-900");
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-stone-900">
          이번 주 라인업
          <span className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-900">
            {filled}/{REQUIRED_SESSIONS.length} 배정
          </span>
        </h2>
        <Link href={`/lineup?event=${event.id}`} className="flex items-center gap-0.5 text-sm font-bold text-accent-600">
          전체 명단 <ArrowRightIcon size={15} />
        </Link>
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
        <ClockIcon size={13} />
        {formatShort(mainDate(event))} {event.type === "weekend" ? "주일 예배" : event.title}
      </p>

      <div className="panel mt-3">
        <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2">
          <h3 className="text-xs font-bold tracking-wide text-stone-600">인도 및 보컬 (WORSHIP &amp; VOCALS)</h3>
          <span className="text-xs font-bold text-emerald-700">확정 {voices.length}명</span>
        </div>
        {voices
          .filter((e) => e.session === "leader")
          .map((e) => (
            <div key={e.key} className="mb-2 flex items-center gap-3 rounded-xl border border-navy-900/10 bg-navy-50 px-3 py-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{e.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-extrabold ${nameClass(e)}`}>
                  {e.name}
                  <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-700">인도자</span>
                </p>
                <p className="text-xs text-stone-500">예배 인도{e.guest ? " · 게스트" : ""}</p>
              </div>
              <StarIcon size={18} className="text-navy-900" />
            </div>
          ))}
        <div className="grid grid-cols-2 gap-2">
          {voices
            .filter((e) => e.session !== "leader")
            .map((e) => (
              <div key={`${e.session}-${e.key}`} className="flex items-center gap-2 rounded-xl border border-stone-200 px-2.5 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">{e.name.slice(0, 1)}</span>
                <span className={`min-w-0 flex-1 truncate text-sm font-bold ${nameClass(e)}`}>{e.name}</span>
                <span className="shrink-0 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-600">
                  {e.guest ? "게스트" : e.session === "sub_leader" ? "서브" : "싱어"}
                </span>
              </div>
            ))}
        </div>
      </div>

      {band.length > 0 && (
        <div className="panel mt-3">
          <div className="mb-1 flex items-center justify-between border-b border-stone-100 pb-2">
            <h3 className="text-xs font-bold tracking-wide text-stone-600">밴드 세션 (INSTRUMENTS)</h3>
            <span className="text-xs font-bold text-emerald-700">{new Set(band.map((e) => e.session)).size}개 파트</span>
          </div>
          <ul className="divide-y divide-stone-100">
            {band.map((e) => (
              <li key={`${e.session}-${e.key}`} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">{e.name.slice(0, 1)}</span>
                <span className={`min-w-0 flex-1 truncate text-[15px] font-bold ${nameClass(e)}`}>
                  {e.name}
                  {e.guest && <span className="ml-1 text-xs font-medium text-stone-400">게스트</span>}
                </span>
                <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-semibold text-stone-700">{SESSION_LABELS[e.session]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
