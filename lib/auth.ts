import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import type { Session } from "@/lib/sessions";
import type { Member } from "@/lib/types";

export const SESSION_COOKIE = "j4u_session";
const SESSION_DAYS = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** 로그인 세션을 만들고 쿠키를 심는다. Server Action/Route Handler에서만 호출 */
export async function startSession(memberId: string) {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into auth_sessions (token_hash, member_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), memberId, SESSION_DAYS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query(`delete from auth_sessions where token_hash = $1`, [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

const MEMBER_COLUMNS = `m.id, m.name, m.phone, m.birth_date, m.email, m.district, m.dong, m.role, m.status, m.created_at`;

/** 로그인한 팀원. 없으면 member가 null */
export async function getCurrentMember() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { member: null, sessions: [] as Session[] };

  const member = await queryOne<Member>(
    `select ${MEMBER_COLUMNS} from auth_sessions s join members m on m.id = s.member_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!member) return { member: null, sessions: [] as Session[] };

  const rows = await query<{ session: Session }>(`select session from member_sessions where member_id = $1`, [member.id]);
  return { member, sessions: rows.map((r) => r.session) };
}

/** 승인된 팀원만 통과. 아니면 알맞은 화면으로 보낸다 */
export async function requireMember() {
  const ctx = await getCurrentMember();
  if (!ctx.member) redirect("/login");
  if (ctx.member.status !== "approved") redirect("/pending");
  return { ...ctx, member: ctx.member };
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.member.role !== "admin") redirect("/");
  return ctx;
}
