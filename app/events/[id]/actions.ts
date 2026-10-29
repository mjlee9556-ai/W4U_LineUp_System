"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireMember } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { canEditSetlist, MAX_SHEET_BYTES, SHEET_TYPES } from "@/lib/setlist";
import { fetchYoutubeTitle, youtubeId, youtubeWatchUrl } from "@/lib/youtube";

const back = (eventId: string, extra = "") => redirect(`/events/${eventId}${extra}`);

async function requireEditor(eventId: string) {
  const { member } = await requireMember();
  if (!(await canEditSetlist(member, eventId))) redirect(`/events/${eventId}`);
  return member;
}

async function eventOfSong(songId: string) {
  const row = await queryOne<{ event_id: string }>(`select event_id from setlist_songs where id = $1`, [songId]);
  if (!row) redirect("/calendar");
  return row.event_id;
}

const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? "").trim().replace(/\s+/g, " ").slice(0, max) || null;

/** 링크 칸은 http(s)만 받는다 */
function link(formData: FormData, key: string): string | null {
  const v = text(formData, key, 500);
  if (!v) return null;
  try {
    const url = new URL(v.startsWith("http") ? v : `https://${v}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 곡 추가 폼에서 유튜브 링크를 붙여 넣으면 부르는 함수: 제목을 가져와 돌려준다 */
export async function lookupYoutube(input: string): Promise<{ url: string | null; title: string | null }> {
  await requireMember();
  const id = youtubeId(input);
  if (!id) return { url: null, title: null };
  return { url: youtubeWatchUrl(id), title: await fetchYoutubeTitle(id) };
}

export async function addSong(formData: FormData) {
  const eventId = String(formData.get("event_id"));
  await requireEditor(eventId);

  const ytId = youtubeId(String(formData.get("youtube_url") ?? ""));
  let title = text(formData, "title", 200);
  if (!title && ytId) title = await fetchYoutubeTitle(ytId);
  if (!title) back(eventId, "?error=title#add-song");

  await query(
    `insert into setlist_songs (event_id, position, title, youtube_url, song_key, sheet_url)
     values ($1, coalesce((select max(position) + 1 from setlist_songs where event_id = $1), 0), $2, $3, $4, $5)`,
    [eventId, title, ytId ? youtubeWatchUrl(ytId) : null, text(formData, "song_key", 20), link(formData, "sheet_url")],
  );
  revalidatePath(`/events/${eventId}`);
  back(eventId, "#add-song");
}

export async function updateSong(formData: FormData) {
  const songId = String(formData.get("song_id"));
  const eventId = await eventOfSong(songId);
  await requireEditor(eventId);
  const title = text(formData, "title", 200);
  if (!title) back(eventId, "?error=title");
  const ytId = youtubeId(String(formData.get("youtube_url") ?? ""));
  await query(
    `update setlist_songs set title = $2, youtube_url = $3, song_key = $4, sheet_url = $5 where id = $1`,
    [songId, title, ytId ? youtubeWatchUrl(ytId) : null, text(formData, "song_key", 20), link(formData, "sheet_url")],
  );
  revalidatePath(`/events/${eventId}`);
  back(eventId, `#song-${songId}`);
}

export async function deleteSong(formData: FormData) {
  const songId = String(formData.get("song_id"));
  const eventId = await eventOfSong(songId);
  await requireEditor(eventId);
  await query(`delete from setlist_songs where id = $1`, [songId]);
  revalidatePath(`/events/${eventId}`);
  back(eventId);
}

/** 곡 순서를 한 칸 위/아래로 */
export async function moveSong(formData: FormData) {
  const songId = String(formData.get("song_id"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const eventId = await eventOfSong(songId);
  await requireEditor(eventId);
  await transaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `select id from setlist_songs where event_id = $1 order by position, created_at`,
      [eventId],
    );
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(songId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) await tx.query(`update setlist_songs set position = $2 where id = $1`, [ids[k], k]);
  });
  revalidatePath(`/events/${eventId}`);
  back(eventId, `#song-${songId}`);
}

export async function uploadSheet(formData: FormData) {
  const songId = String(formData.get("song_id"));
  const eventId = await eventOfSong(songId);
  await requireEditor(eventId);
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) back(eventId, `?error=file#song-${songId}`);
  for (const f of files) {
    if (f.size > MAX_SHEET_BYTES) back(eventId, `?error=size#song-${songId}`);
    if (!SHEET_TYPES.includes(f.type)) back(eventId, `?error=type#song-${songId}`);
  }
  for (const f of files) {
    await query(`insert into sheet_files (song_id, filename, content_type, size, data) values ($1, $2, $3, $4, $5)`, [
      songId,
      f.name.slice(0, 120) || "악보",
      f.type,
      f.size,
      Buffer.from(await f.arrayBuffer()),
    ]);
  }
  revalidatePath(`/events/${eventId}`);
  back(eventId, `#song-${songId}`);
}

export async function deleteSheet(formData: FormData) {
  const fileId = String(formData.get("file_id"));
  const row = await queryOne<{ song_id: string }>(`select song_id from sheet_files where id = $1`, [fileId]);
  if (!row) redirect("/calendar");
  const eventId = await eventOfSong(row.song_id);
  await requireEditor(eventId);
  await query(`delete from sheet_files where id = $1`, [fileId]);
  revalidatePath(`/events/${eventId}`);
  back(eventId, `#song-${row.song_id}`);
}

/** 성찬식 주일 공지 문구 (관리자) */
export async function saveCommunionNotice(formData: FormData) {
  await requireAdmin();
  const value = text(formData, "notice", 200);
  if (value) {
    await query(
      `insert into app_settings (key, value) values ('communion_notice', $1) on conflict (key) do update set value = excluded.value`,
      [value],
    );
  } else {
    await query(`delete from app_settings where key = 'communion_notice'`);
  }
  revalidatePath("/", "layout");
  redirect("/admin?saved=notice");
}
