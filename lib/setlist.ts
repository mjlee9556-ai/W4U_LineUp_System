import "server-only";
import { query, queryOne } from "@/lib/db";
import type { Member } from "@/lib/types";

export type SheetFile = { id: string; song_id: string; filename: string; content_type: string; size: number };
export type SetlistSong = {
  id: string;
  event_id: string;
  position: number;
  title: string;
  youtube_url: string | null;
  song_key: string | null;
  sheet_url: string | null;
  files: SheetFile[];
};

/** 악보 파일 한 개 최대 크기. Vercel 함수 요청 한도(4.5MB) 안쪽 */
export const MAX_SHEET_BYTES = 4 * 1024 * 1024;
export const SHEET_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export const DEFAULT_COMMUNION_NOTICE = "성찬식 주일이에요. 무채색 옷을 입고 와 주세요.";

/** 콘티를 고칠 수 있는 사람: 관리자, 그 주에 인도자·서브 인도자로 배정된 사람 */
export async function canEditSetlist(member: Pick<Member, "id" | "role">, eventId: string): Promise<boolean> {
  if (member.role === "admin") return true;
  const row = await queryOne(
    `select 1 from lineup_assignments where event_id = $1 and member_id = $2 and session in ('leader', 'sub_leader')`,
    [eventId, member.id],
  );
  return !!row;
}

export async function getSetlists(eventIds: string[]): Promise<Map<string, SetlistSong[]>> {
  const result = new Map<string, SetlistSong[]>();
  if (!eventIds.length) return result;
  const songs = await query<Omit<SetlistSong, "files">>(
    `select id, event_id, position, title, youtube_url, song_key, sheet_url
       from setlist_songs where event_id = any($1::uuid[]) order by position, created_at`,
    [eventIds],
  );
  const files = songs.length
    ? await query<SheetFile>(
        `select id, song_id, filename, content_type, size from sheet_files where song_id = any($1::uuid[]) order by created_at`,
        [songs.map((s) => s.id)],
      )
    : [];
  for (const s of songs) {
    const list = result.get(s.event_id) ?? [];
    list.push({ ...s, files: files.filter((f) => f.song_id === s.id) });
    result.set(s.event_id, list);
  }
  return result;
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await queryOne<{ value: string }>(`select value from app_settings where key = $1`, [key]);
  return row?.value ?? fallback;
}
