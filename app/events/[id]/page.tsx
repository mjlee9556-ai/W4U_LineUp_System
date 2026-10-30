import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatShort, isCommunionSunday } from "@/lib/dates";
import { buildLineup, groupBySession, practiceDates, serviceDates } from "@/lib/lineup";
import { getMemberNames, withDays } from "@/lib/queries";
import { SESSION_LABELS } from "@/lib/sessions";
import { canEditSetlist, DEFAULT_COMMUNION_NOTICE, getSetlists, getSetting, type SetlistSong } from "@/lib/setlist";
import { EVENT_TYPE_LABELS, type Assignment, type Guest, type LineupEvent } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
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

  const isAdmin = member.role === "admin";
  const confirmed = event.lineup_status === "confirmed";
  const canEdit = await canEditSetlist(member, id);
  const showLineup = confirmed || isAdmin;
  const showSetlist = confirmed || canEdit;

  const [assignments, guests, setlists] = await Promise.all([
    showLineup ? query<Assignment>(`select * from lineup_assignments where event_id = $1`, [id]) : [],
    showLineup ? query<Guest>(`select * from lineup_guests where event_id = $1 order by name`, [id]) : [],
    showSetlist ? getSetlists([id]) : new Map<string, SetlistSong[]>(),
  ]);
  const names = await getMemberNames(assignments.map((a) => a.member_id));
  const lineup = buildLineup(assignments, names, guests);
  const songs = setlists.get(id) ?? [];

  const dates = serviceDates(event);
  const practice = practiceDates(event);
  const communion = dates.some(isCommunionSunday);
  const communionNotice = communion ? await getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE) : "";

  return (
    <AppShell member={member}>
      <Link href={`/calendar?month=${event.end_date.slice(0, 7)}`} className="text-sm text-stone-500 hover:underline">
        ← 캘린더
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">
          {event.type === "weekend" ? `${formatShort(event.end_date)} 주일` : event.title}
        </h1>
        {communion && <span className="rounded-full bg-stone-800 px-2 py-0.5 text-xs font-semibold text-white">성찬식</span>}
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {EVENT_TYPE_LABELS[event.type]} · 예배 {dates.map(formatShort).join(", ")}
        {practice.length > 0 ? ` · 연습 ${practice.map(formatShort).join(", ")}` : event.type === "weekend" ? " · 토 연습 없음" : ""}
        {isAdmin && (
          <>
            {" · "}
            <Link href={`/admin/events/${id}`} className="underline-offset-2 hover:underline">라인업 편성</Link>
          </>
        )}
      </p>
      {communion && (
        <p className="mt-3 rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-800">🕊️ {communionNotice}</p>
      )}

      <div className="mt-4">
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />
      </div>

      <section className="card">
        <h2 className="font-semibold">라인업 {showLineup && !confirmed && <span className="text-xs font-normal text-stone-500">(편성 중, 관리자만 보여요)</span>}</h2>
        {!showLineup || lineup.length === 0 ? (
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
                      <span className={e.memberId === member.id ? "font-semibold text-amber-700" : ""}>{e.name}</span>
                      {e.guest && <span className="ml-1 rounded bg-stone-100 px-1 text-xs text-stone-600">게스트</span>}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">콘티 {songs.length > 0 && <span className="text-sm font-normal text-stone-500">{songs.length}곡</span>}</h2>
          {canEdit && <span className="text-xs text-stone-500">{isAdmin ? "관리자" : "인도자"}라서 고칠 수 있어요</span>}
        </div>
        {!showSetlist ? (
          <p className="mt-2 text-sm text-stone-500">라인업이 확정되면 콘티와 악보가 보여요.</p>
        ) : songs.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">아직 올라온 곡이 없어요.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {songs.map((song, i) => (
              <li key={song.id} id={`song-${song.id}`} className="card scroll-mt-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {song.title}
                      {song.song_key && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">{song.song_key}</span>}
                    </div>
                    {song.song_form && <div className="mt-1 font-mono text-xs text-stone-700">{song.song_form}</div>}
                    {song.memo && <p className="mt-1 whitespace-pre-line text-xs text-stone-600">{song.memo}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {song.youtube_url && (
                        <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="text-red-700 underline-offset-2 hover:underline">
                          ▶ 유튜브
                        </a>
                      )}
                      {song.sheet_url && (
                        <a href={song.sheet_url} target="_blank" rel="noopener noreferrer" className="text-stone-700 underline-offset-2 hover:underline">
                          악보 링크
                        </a>
                      )}
                    </div>
                    {song.files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {song.files.map((f) => (
                          <div key={f.id} className="relative">
                            <a href={`/sheets/${f.id}`} target="_blank" rel="noopener" title={f.filename} className="block">
                              {f.content_type.startsWith("image/") && f.content_type !== "image/heic" && f.content_type !== "image/heif" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`/sheets/${f.id}`} alt={`${song.title} 악보`} className="h-28 w-20 rounded border border-stone-200 object-cover" />
                              ) : (
                                <span className="flex h-28 w-20 items-center justify-center rounded border border-stone-200 bg-stone-50 p-1 text-center text-[10px] text-stone-600">
                                  📄 {f.filename}
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
