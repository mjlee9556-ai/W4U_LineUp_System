import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatShort, isCommunionSunday, weekOfMonthLabel } from "@/lib/dates";
import { buildLineup, groupBySession, practiceDates, serviceDates } from "@/lib/lineup";
import { getMemberNames, withDays } from "@/lib/queries";
import { SESSION_SHORT } from "@/lib/sessions";
import { canEditSetlist, DEFAULT_COMMUNION_NOTICE, getSetlists, getSetting, type SetlistSong } from "@/lib/setlist";
import { EVENT_TYPE_LABELS, type Assignment, type Guest, type LineupEvent, isAdmin as canManage } from "@/lib/types";
import { eventLabel, getSelectableEvents, mainDate } from "@/lib/week";
import { AppShell } from "@/components/AppShell";
import { EventPicker } from "@/components/EventPicker";
import { ArrowRightIcon, ClockIcon, FileIcon, LinkIcon, ListMusicIcon, PencilIcon, PlayCircleIcon } from "@/components/icons";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Notice } from "@/components/Notice";
import { SheetUpload } from "@/components/SheetUpload";
import { SetlistDraft } from "@/components/SetlistDraft";
import { SongFields } from "@/components/SongFields";
import { SubmitButton } from "@/components/SubmitButton";
import { addSongs, deleteSheet, deleteSong, moveSong, updateSong, uploadSheet } from "./actions";

const ERRORS: Record<string, string> = {
  title: "곡 제목을 입력해 주세요. (유튜브 제목을 가져오지 못했을 때는 직접 적어 주세요)",
  file: "올릴 파일을 골라 주세요.",
  size: "악보 파일은 하나에 4MB까지 올릴 수 있어요. 더 크면 악보 링크로 넣어 주세요.",
  type: "악보는 사진(JPG·PNG·WEBP·HEIC)이나 PDF만 올릴 수 있어요.",
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { member } = await requireMember();

  const found = await queryOne<LineupEvent>(`select * from events where id = $1`, [id]).catch(() => null);
  if (!found) notFound();
  const [event] = await withDays([found]);

  const isAdmin = canManage(member);
  const confirmed = event.lineup_status === "confirmed";
  const canEdit = await canEditSetlist(member, id);
  const showLineup = confirmed || isAdmin;
  const showSetlist = confirmed || canEdit;

  const [assignments, guests, setlists] = await Promise.all([
    showLineup ? query<Assignment>(`select * from lineup_assignments where event_id = $1`, [id]) : [],
    showLineup ? query<Guest>(`select * from lineup_guests where event_id = $1 order by name`, [id]) : [],
    showSetlist ? getSetlists([id]) : new Map<string, SetlistSong[]>(),
  ]);
  const [names, selectable] = await Promise.all([getMemberNames(assignments.map((a) => a.member_id)), getSelectableEvents(member)]);
  const pickerOptions = (selectable.some((e) => e.id === id) ? selectable : [...selectable, event]).map((e) => ({ id: e.id, label: eventLabel(e) }));
  const lineup = buildLineup(assignments, names, guests);
  const songs = setlists.get(id) ?? [];

  const dates = serviceDates(event);
  const practice = practiceDates(event);
  const communion = dates.some(isCommunionSunday);
  const communionNotice = communion ? await getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE) : "";

  return (
    <AppShell member={member}>
      <div className="flex items-center gap-2">
        <EventPicker options={pickerOptions} value={id} basePath="/events/" />
        {isAdmin && (
          <Link
            href={`/admin/events/${id}`}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            <PencilIcon size={15} />
            라인업 편성
          </Link>
        )}
      </div>

      <section className="relative mt-4 overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-white/90">{EVENT_TYPE_LABELS[event.type]}</span>
          {communion && <span className="rounded-md bg-accent-600 px-2 py-0.5 text-xs font-bold">성찬식</span>}
          {!confirmed && <span className="rounded-md bg-amber-400/90 px-2 py-0.5 text-xs font-bold text-amber-950">편성 중</span>}
        </div>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight">
          {event.type === "weekend" ? `${weekOfMonthLabel(mainDate(event))} 주일 예배` : event.title}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
          <ClockIcon size={15} />
          예배 {dates.map(formatShort).join(", ")}
          {practice.length > 0 ? ` · 연습 ${practice.map(formatShort).join(", ")}` : event.type === "weekend" ? " · 토 연습 없음" : ""}
        </p>
        {communion && <p className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90">🕊️ {communionNotice}</p>}
      </section>

      <div className="mt-4">
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />
      </div>

      <section className="panel">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-stone-900">
            라인업 {showLineup && !confirmed && <span className="text-xs font-normal text-stone-500">(편성 중, 관리자만 보여요)</span>}
          </h2>
          {showLineup && lineup.length > 0 && (
            <Link href={`/lineup?event=${id}`} className="flex items-center gap-0.5 text-xs font-bold text-accent-600">
              자세히 <ArrowRightIcon size={13} />
            </Link>
          )}
        </div>
        {!showLineup || lineup.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">아직 라인업을 편성하고 있어요.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {groupBySession(lineup).flatMap((g) =>
              g.entries.map((e) => (
                <span
                  key={`${g.session}-${e.key}`}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                    e.memberId === member.id ? "border-accent-300 bg-accent-50 text-accent-600" : "border-stone-200 bg-stone-50 text-stone-700"
                  }`}
                >
                  <span className="text-stone-400">{SESSION_SHORT[g.session]}</span>
                  <b>{e.name}</b>
                  {e.guest && <span className="text-stone-400">(G)</span>}
                </span>
              )),
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-stone-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <ListMusicIcon size={17} />
            </span>
            예배 콘티
            {songs.length > 0 && <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-600">{songs.length}곡</span>}
          </h2>
          {canEdit && <span className="text-xs text-stone-500">{isAdmin ? "관리자" : "인도자"}라서 고칠 수 있어요</span>}
        </div>
        {!showSetlist ? (
          <p className="mt-2 text-sm text-stone-500">라인업이 확정되면 콘티와 악보가 보여요.</p>
        ) : songs.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">아직 올라온 곡이 없어요.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {songs.map((song, i) => (
              <li key={song.id} id={`song-${song.id}`} className="panel scroll-mt-20">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 font-mono text-[15px] font-extrabold text-stone-700">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[17px] font-extrabold text-stone-900">{song.title}</span>
                      {song.song_key && (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-800">{song.song_key} Key</span>
                      )}
                    </div>
                    {song.song_form && <div className="mt-1 font-mono text-xs text-stone-700">{song.song_form}</div>}
                    {song.memo && <p className="mt-1 whitespace-pre-line text-xs text-stone-600">{song.memo}</p>}
                    {(song.youtube_url || song.sheet_url) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                        {song.sheet_url && (
                          <a href={song.sheet_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100">
                            <LinkIcon size={13} />
                            악보 링크
                          </a>
                        )}
                        {song.youtube_url && (
                          <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-red-700 hover:bg-stone-100">
                            <PlayCircleIcon size={13} />
                            음원
                          </a>
                        )}
                      </div>
                    )}
                    {song.files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {song.files.map((f) => (
                          <div key={f.id} className="relative">
                            <a href={`/sheets/${f.id}`} target="_blank" rel="noopener" title={f.filename} className="block">
                              {f.content_type.startsWith("image/") && f.content_type !== "image/heic" && f.content_type !== "image/heif" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`/sheets/${f.id}`} alt={`${song.title} 악보`} className="h-28 w-20 rounded-lg border border-stone-200 object-cover" />
                              ) : (
                                <span className="flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 text-center text-[10px] text-stone-600">
                                  <FileIcon size={18} />
                                  <span className="line-clamp-2 break-all">{f.filename}</span>
                                </span>
                              )}
                            </a>
                            {canEdit && (
                              <form action={deleteSheet} className="absolute -right-1.5 -top-1.5">
                                <input type="hidden" name="file_id" value={f.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={`악보 '${f.filename}'을(를) 지울까요?`}
                                  pendingText="…"
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-800 text-xs text-white"
                                >
                                  ×
                                </ConfirmSubmitButton>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                    <form action={moveSong}>
                      <input type="hidden" name="song_id" value={song.id} />
                      <input type="hidden" name="dir" value="up" />
                      <SubmitButton className="btn-secondary px-2 py-1 text-xs" pendingText="…" disabled={i === 0} aria-label="위로">↑</SubmitButton>
                    </form>
                    <form action={moveSong}>
                      <input type="hidden" name="song_id" value={song.id} />
                      <input type="hidden" name="dir" value="down" />
                      <SubmitButton className="btn-secondary px-2 py-1 text-xs" pendingText="…" disabled={i === songs.length - 1} aria-label="아래로">↓</SubmitButton>
                    </form>
                    <SheetUpload songId={song.id} action={uploadSheet} />
                    <form action={deleteSong} className="ml-auto">
                      <input type="hidden" name="song_id" value={song.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`'${song.title}'을(를) 콘티에서 뺄까요? 올린 악보도 함께 지워져요.`}
                        pendingText="…"
                        className="px-2 py-1 text-xs text-red-700 hover:underline"
                      >
                        곡 빼기
                      </ConfirmSubmitButton>
                    </form>
                    <details className="w-full">
                      <summary className="cursor-pointer text-xs text-stone-500">곡 정보 고치기</summary>
                      <form action={updateSong} className="mt-2 space-y-2">
                        <input type="hidden" name="song_id" value={song.id} />
                        <SongFields defaults={song} />
                        <SubmitButton className="btn-primary px-3 py-1.5 text-sm">저장</SubmitButton>
                      </form>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {canEdit && (
          <SetlistDraft key={songs.length} eventId={id} initialRows={songs.length === 0 ? 5 : 1} action={addSongs} />
        )}
      </section>
    </AppShell>
  );
}
