import { getCurrentMember } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canEditSetlist } from "@/lib/setlist";

/** 악보 파일 내려받기: 로그인한 팀원은 확정된 주의 악보를, 편집할 수 있는 사람은 언제든 본다 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await getCurrentMember();
  if (!member || member.status !== "approved") return new Response("로그인이 필요해요", { status: 401 });

  const file = await queryOne<{ filename: string; content_type: string; data: Uint8Array; event_id: string; lineup_status: string }>(
    `select f.filename, f.content_type, f.data, s.event_id, e.lineup_status
       from sheet_files f join setlist_songs s on s.id = f.song_id join events e on e.id = s.event_id
      where f.id = $1`,
    [id],
  ).catch(() => null);
  if (!file) return new Response("없는 파일이에요", { status: 404 });
  if (file.lineup_status !== "confirmed" && !(await canEditSetlist(member, file.event_id))) {
    return new Response("아직 공개되지 않았어요", { status: 403 });
  }

  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
