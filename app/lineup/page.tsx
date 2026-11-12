import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatShort, isCommunionSunday } from "@/lib/dates";
import { practiceDates, serviceDates, type LineupEntry } from "@/lib/lineup";
import { REQUIRED_SESSIONS, SESSION_GROUPS, SESSION_LABELS, type Session } from "@/lib/sessions";
import { DEFAULT_COMMUNION_NOTICE, getSetlists, getSetting } from "@/lib/setlist";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { eventLabel, getLineup, getSelectableEvents, mainDate, pickCurrent } from "@/lib/week";
import { AppShell } from "@/components/AppShell";
import { EventPicker } from "@/components/EventPicker";
import { ShareButton } from "@/components/ShareButton";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";

const GROUP_TONE: Record<string, string> = {
  vocal: "border-accent-300/60 bg-accent-50 text-accent-600",
  keys: "border-navy-900/10 bg-navy-50 text-navy-900",
  guitar: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rhythm: "border-amber-200 bg-amber-50 text-amber-800",
};

const initial = (name: string) => name.trim().slice(0, 1);

export default async function LineupPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { member } = await requireMember();
  const { event: wanted } = await searchParams;
  const isAdmin = member.role === "admin";

  const events = await getSelectableEvents(member);
  const event = events.find((e) => e.id === wanted) ?? pickCurrent(events);

  if (!event) {
    return (
      <AppShell member={member}>
        <h1 className="text-[22px] font-extrabold tracking-tight text-stone-900">라인업</h1>
        <div className="panel mt-4 py-10 text-center text-sm text-stone-500">
          <UsersIcon size={28} className="mx-auto mb-2 text-stone-300" />
          아직 확정된 라인업이 없어요.
          <br />
          관리자가 라인업을 확정하면 여기에 보여요.
        </div>
      </AppShell>
    );
  }

  const [lineup, setlists] = await Promise.all([getLineup(event.id), getSetlists([event.id])]);
  const songCount = setlists.get(event.id)?.length ?? 0;
  const confirmed = event.lineup_status === "confirmed";
  const date = mainDate(event);
  const practice = practiceDates(event);
  const communion = serviceDates(event).some(isCommunionSunday);
  const communionNotice = communion ? await getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE) : "";

  const bySession = new Map<Session, LineupEntry[]>();
  for (const e of lineup) bySession.set(e.session, [...(bySession.get(e.session) ?? []), e]);
  const filled = REQUIRED_SESSIONS.filter((s) => bySession.has(s));
  const vacant = REQUIRED_SESSIONS.length - filled.length;
  const percent = Math.round((filled.length / REQUIRED_SESSIONS.length) * 100);
  const people = new Set(lineup.map((e) => e.key)).size;
  const editHref = `/admin/events/${event.id}`;

  const leaders = bySession.get("leader") ?? [];
  const subLeaders = bySession.get("sub_leader") ?? [];

  return (
    <AppShell member={member}>
      <div className="flex items-center gap-2">
        <EventPicker options={events.map((e) => ({ id: e.id, label: eventLabel(e) }))} value={event.id} basePath="/lineup" />
        {isAdmin && (
          <Link
            href={editHref}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            <PencilIcon size={15} />
            배정 수정
          </Link>
        )}
      </div>

      {event.type !== "weekend" && (
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-navy-900 px-3.5 py-1.5 text-[13px] font-bold text-white">{event.title}</span>
          <span className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-stone-600">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        </div>
      )}

      {/* 배정 현황 */}
      <section className="panel mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-600">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
              Lineup status · {confirmed ? "확정" : "편성 중"}
            </p>
            <h1 className="mt-1 text-[19px] font-extrabold tracking-tight text-stone-900">
              {REQUIRED_SESSIONS.length}개 세션 중 {filled.length}개 {confirmed ? "확정" : "배정"}
            </h1>
            <p className="mt-0.5 text-[13px] text-stone-600">
              배정 완성도 {percent}% · 팀원 {people}명
              {vacant > 0 && <span className="font-semibold text-accent-600"> · 공석 {vacant}석</span>}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-stone-200 px-3 py-1.5 text-center">
            <div className="text-xl font-extrabold leading-tight text-navy-900">{filled.length}</div>
            <div className="border-t border-stone-200 text-[11px] font-semibold text-stone-500">/{REQUIRED_SESSIONS.length}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-navy-900" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-stone-600">
            <ClockIcon size={16} className="shrink-0" />
            <span className="truncate">
              {practice.length ? `연습: ${practice.map(formatShort).join(", ")}` : event.type === "weekend" ? "토 연습 없음" : `예배: ${serviceDates(event).map(formatShort).join(", ")}`}
            </span>
          </p>
          {confirmed && (
            <ShareButton
              path={`/lineup?event=${event.id}`}
              title={`J4U 찬양팀 ${eventLabel(event)} 라인업`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-[13px] font-bold text-white hover:bg-navy-800"
            >
              <SendIcon size={14} />
              라인업 공유
            </ShareButton>
          )}
        </div>
        {!confirmed && <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">편성 중인 라인업은 관리자에게만 보여요.</p>}
      </section>

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-[17px] font-extrabold text-stone-900">
          세션 배치표 <span className="ml-1 text-xs font-medium text-stone-500">파트별 인원 현황</span>
        </h2>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-600">
          {EVENT_TYPE_LABELS[event.type]} {formatShort(date)}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {/* 예배 인도자 */}
        <section className="panel">
          {leaders.length === 0 ? (
            <Vacant label="예배 인도자" href={isAdmin ? editHref : undefined} />
          ) : (
            leaders.map((e) => (
              <div key={e.key} className="flex items-center gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-50 text-lg font-extrabold text-accent-600">
                  {initial(e.name)}
                  <span className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-white">
                    <StarIcon size={11} fill="currentColor" />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[17px] font-extrabold ${e.memberId === member.id ? "text-accent-600" : "text-stone-900"}`}>{e.name}</span>
                    <span className="rounded-md border border-accent-300/70 bg-accent-50 px-1.5 py-0.5 text-[11px] font-bold text-accent-600">인도자</span>
                    <Tags entry={e} me={member.id} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${songCount ? "bg-emerald-500" : "bg-stone-300"}`} />
                    {songCount ? `콘티 ${songCount}곡 등록 완료` : "콘티 준비 중"}
                  </p>
                </div>
                <StatusChip confirmed={confirmed} />
              </div>
            ))
          )}
          {subLeaders.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 pt-3 text-sm">
              <span className="text-xs font-semibold text-stone-500">서브 인도자</span>
              {subLeaders.map((e) => (
                <span key={e.key} className={`font-bold ${e.memberId === member.id ? "text-accent-600" : "text-stone-800"}`}>
                  {e.name}
                  <Tags entry={e} me={member.id} />
                </span>
              ))}
            </div>
          )}
        </section>

        {SESSION_GROUPS.filter((g) => g.key !== "lead").map((group) => {
          const required = group.sessions.filter((s) => REQUIRED_SESSIONS.includes(s));
          const missing = required.filter((s) => !bySession.has(s));
          const entries = group.sessions.flatMap((s) => bySession.get(s) ?? []);
          const tiles = group.key === "guitar" || group.key === "rhythm";
          return (
            <section key={group.key} className="panel">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${GROUP_TONE[group.key]}`}>{group.label}</span>
                  <span className="truncate text-xs text-stone-500">
                    {entries.length}명 배정
                    {missing.length > 0 && <span className="font-semibold text-accent-600"> · {missing.length}석 공석</span>}
                  </span>
                </div>
                {missing.length === 0 ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckIcon size={14} strokeWidth={2.4} />
                    {confirmed ? "전원 확정" : "전원 배정"}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-600">
                    <AlertCircleIcon size={14} />
                    {isAdmin ? "배정 필요" : "공석"}
                  </span>
                )}
              </div>

              {tiles ? (
                <div className="grid grid-cols-2 gap-2">
                  {group.sessions.map((s) => {
                    const list = bySession.get(s) ?? [];
                    if (list.length === 0) return <Vacant key={s} label={SESSION_LABELS[s]} href={isAdmin ? editHref : undefined} compact />;
                    return (
                      <div key={s} className="rounded-xl bg-stone-50 px-3 py-2.5">
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          {SESSION_LABELS[s]}
                          <span className={`h-1.5 w-1.5 rounded-full ${confirmed ? "bg-emerald-500" : "bg-amber-400"}`} />
                        </div>
                        {list.map((e) => (
                          <div key={e.key} className="mt-1.5 flex items-center gap-2">
                            <Avatar name={e.name} />
                            <span className={`truncate text-[15px] font-bold ${e.memberId === member.id ? "text-accent-600" : "text-stone-900"}`}>{e.name}</span>
                            <Tags entry={e} me={member.id} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {group.sessions.map((s) => {
                    const list = bySession.get(s) ?? [];
                    if (list.length === 0) {
                      return required.includes(s) ? <Vacant key={s} label={SESSION_LABELS[s]} href={isAdmin ? editHref : undefined} /> : null;
                    }
                    return list.map((e) => (
                      <div key={`${s}-${e.key}`} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                        <Avatar name={e.name} />
                        <div className="min-w-0 flex-1">
                          <span className={`text-[15px] font-bold ${e.memberId === member.id ? "text-accent-600" : "text-stone-900"}`}>{e.name}</span>
                          <span className="ml-1.5 text-xs text-stone-500">{SESSION_LABELS[s]}</span>
                          <Tags entry={e} me={member.id} />
                        </div>
                        <StatusChip confirmed={confirmed} small />
                      </div>
                    ));
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-4 rounded-2xl border border-stone-200 bg-stone-100/70 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-stone-900">
          <InfoIcon size={17} />
          리허설 에티켓 &amp; 공지사항
        </h2>
        <div className="mt-1.5 space-y-1.5 pl-[25px] text-[13px] leading-relaxed text-stone-600">
          {communion && <p>🕊️ {communionNotice}</p>}
          {event.note && <p className="whitespace-pre-line">{event.note}</p>}
          <p>
            {practice.length ? `토 연습은 ${practice.map(formatShort).join(", ")}이에요. ` : ""}
            참석이 어려워지면 가능한 빨리 관리자에게 알려 주세요. 라인업이 바뀌면 이 화면에 바로 반영돼요.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-sm font-bold text-stone-600">
      {initial(name)}
    </span>
  );
}

function Tags({ entry, me }: { entry: LineupEntry; me: string }) {
  return (
    <>
      {entry.memberId === me && <span className="ml-1 rounded bg-accent-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">나</span>}
      {entry.guest && <span className="ml-1 rounded bg-stone-200 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-stone-600">게스트</span>}
      {entry.satAbsent && <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-red-700">토 불참</span>}
    </>
  );
}

function StatusChip({ confirmed, small = false }: { confirmed: boolean; small?: boolean }) {
  return confirmed ? (
    <span className={`flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white font-semibold text-stone-700 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <CheckCircleIcon size={small ? 12 : 14} />
      확정
    </span>
  ) : (
    <span className={`shrink-0 rounded-full bg-amber-50 font-semibold text-amber-700 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>편성 중</span>
  );
}

function Vacant({ label, href, compact = false }: { label: string; href?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-dashed border-accent-300 bg-accent-50/60 ${compact ? "px-3 py-2.5" : "px-3 py-3"}`}>
      {!compact && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-accent-300 text-sm font-bold text-accent-600">?</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-accent-600">{label}</p>
        <p className="text-xs text-stone-500">공석</p>
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 rounded-lg bg-accent-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-accent-500">
          <PlusIcon size={13} strokeWidth={2.4} />
          {compact ? "배정" : "팀원 배정"}
        </Link>
      )}
    </div>
  );
}
