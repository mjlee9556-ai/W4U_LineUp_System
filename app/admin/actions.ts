"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { addDays, isValidMonth, monthStart, todayKST, weekendSets } from "@/lib/dates";
import { hashPin } from "@/lib/pin";
import { autoAssign } from "@/lib/autoassign";
import { parseGuestNames } from "@/lib/lineup";
import { isSession, SESSIONS, SIGNUP_SESSIONS, type Session } from "@/lib/sessions";
import type { EventType, MemberStatus } from "@/lib/types";

export async function setMemberStatus(formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status")) as MemberStatus;
  if (!["approved", "inactive", "pending"].includes(status)) return;
  await query(`update members set status = $2 where id = $1`, [String(formData.get("member_id")), status]);
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export async function setMemberRole(formData: FormData) {
  const { member } = await requireAdmin();
  const id = String(formData.get("member_id"));
  const role = String(formData.get("role")) === "admin" ? "admin" : "member";
  if (id === member.id && role === "member") redirect("/admin/members?error=self");
  await query(`update members set role = $2 where id = $1`, [id, role]);
  revalidatePath("/admin/members");
}

/**
 * 계정을 지운다. 응답·임시 배정·로그인 세션은 함께 지워지고,
 * 이미 확정된 라인업에서는 이름만 남도록 게스트로 바꿔 캘린더 기록을 지킨다.
 * 본인은 지울 수 없으므로 관리자가 한 명도 없게 되는 일은 없다.
 */
export async function deleteMember(formData: FormData) {
  const { member } = await requireAdmin();
  const id = String(formData.get("member_id"));
  if (id === member.id) redirect("/admin/members?error=self-delete");

  const name = await transaction(async (tx) => {
    const { rows } = await tx.query<{ name: string }>(`select name from members where id = $1`, [id]);
    if (!rows[0]) return null;
    await tx.query(
      `insert into lineup_guests (event_id, session, name)
       select a.event_id, a.session, m.name
         from lineup_assignments a
         join events e on e.id = a.event_id and e.lineup_status = 'confirmed'
         join members m on m.id = a.member_id
        where a.member_id = $1`,
      [id],
    );
    await tx.query(`delete from members where id = $1`, [id]);
    return rows[0].name;
  });

  revalidatePath("/admin");
  revalidatePath("/calendar");
  redirect(`/admin/members?deleted=${encodeURIComponent(name ?? "")}`);
}

/** 임시 PIN을 만들어 관리자 화면에 한 번 보여준다 */
export async function resetPin(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("member_id"));
  const temp = String(randomInt(0, 10000)).padStart(4, "0");
  const target = await queryOne<{ name: string }>(
    `update members set pin_hash = $2, failed_logins = 0, locked_until = null where id = $1 returning name`,
    [id, hashPin(temp)],
  );
  await query(`delete from auth_sessions where member_id = $1`, [id]);
  // 주소창·로그에 남지 않도록 1분짜리 쿠키로 한 번만 전달
  (await cookies()).set("j4u_flash_pin", JSON.stringify({ name: target?.name ?? "", pin: temp }), {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin/members",
    maxAge: 60,
  });
  redirect("/admin/members");
}

function randomCode() {
  // 헷갈리는 글자(0/O, 1/I)는 뺀다
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export async function createInviteCode(formData: FormData) {
  const { member } = await requireAdmin();
  const maxUses = Number(formData.get("max_uses")) || null;
  const days = Number(formData.get("expires_days")) || null;
  await query(
    `insert into invite_codes (code, created_by, max_uses, expires_at)
     values ($1, $2, $3, case when $4::int is null then null else now() + make_interval(days => $4::int) end)`,
    [randomCode(), member.id, maxUses, days],
  );
  revalidatePath("/admin");
}

export async function deleteInviteCode(formData: FormData) {
  await requireAdmin();
  await query(`delete from invite_codes where code = $1`, [String(formData.get("code"))]);
  revalidatePath("/admin");
}

/** 수집 회차를 열고 그 달 주말 세트(토 연습 + 일 예배)를 만든다 */
export async function createRound(formData: FormData) {
  await requireAdmin();
  const month = String(formData.get("month"));
  const closesOn = String(formData.get("closes_on") ?? "");
  if (!isValidMonth(month)) redirect("/admin?error=month");
  if (closesOn && closesOn < todayKST()) redirect("/admin?error=closes");

  // 마감일은 그날 자정(한국 시간)까지
  const closesAt = closesOn ? `${addDays(closesOn, 1)}T00:00:00+09:00` : null;

  let roundId: string;
  try {
    roundId = await transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into availability_rounds (target_month, closes_at) values ($1, $2) returning id`,
        [monthStart(month), closesAt],
      );
      for (const set of weekendSets(month)) {
        const event = await tx.query<{ id: string }>(
          `insert into events (round_id, type, title, start_date, end_date) values ($1, 'weekend', '주일 예배', $2, $3) returning id`,
          [rows[0].id, set.saturday, set.sunday],
        );
        await tx.query(
          `insert into event_days (event_id, date, kind) values ($1, $2, 'practice'), ($1, $3, 'service')`,
          [event.rows[0].id, set.saturday, set.sunday],
        );
      }
      return rows[0].id;
    });
  } catch {
    redirect("/admin?error=round");
  }

  revalidatePath("/admin");
  redirect(`/admin/rounds/${roundId}`);
}

export async function setRoundStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("round_id"));
  const status = String(formData.get("status")) === "open" ? "open" : "closed";
  await query(`update availability_rounds set status = $2 where id = $1`, [id, status]);
  revalidatePath(`/admin/rounds/${id}`);
}

/** 회차를 지운다. 그 달 주일 세트와 응답·라인업도 함께 지워진다 (on delete cascade) */
export async function deleteRound(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("round_id"));
  await query(`delete from availability_rounds where id = $1`, [id]);
  revalidatePath("/admin");
  revalidatePath("/calendar");
  revalidatePath("/availability");
  redirect("/admin?deleted=round");
}

/** 주일 세트의 토요일 연습을 없애거나 되살린다 (라인업 확정 전만) */
export async function toggleSaturdayPractice(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("event_id"));

  const roundId = await transaction(async (tx) => {
    const { rows } = await tx.query<{ round_id: string; start_date: string; has_practice: boolean }>(
      `select round_id, start_date,
              exists(select 1 from event_days d where d.event_id = e.id and d.kind = 'practice') as has_practice
         from events e where id = $1 and type = 'weekend' and lineup_status = 'draft'`,
      [eventId],
    );
    const event = rows[0];
    if (!event) return null;

    if (event.has_practice) {
      await tx.query(`delete from event_days where event_id = $1 and kind = 'practice'`, [eventId]);
      // 이미 낸 응답은 연습 없는 주에 맞게 '가능'으로 바꾼다
      await tx.query(
        `update availabilities set status = 'available' where event_id = $1 and status in ('both', 'sun_only')`,
        [eventId],
      );
    } else {
      // 토요일 연습을 되살리면 '가능'으로 냈던 사람은 토·일 중 다시 골라야 한다 (화면에서 선택이 비어 보인다)
      await tx.query(`insert into event_days (event_id, date, kind) values ($1, $2, 'practice')`, [eventId, event.start_date]);
    }
    return event.round_id;
  });

  if (roundId) revalidatePath(`/admin/rounds/${roundId}`);
  revalidatePath("/availability");
  revalidatePath("/calendar");
}

/** 수련회·특별예배: 월 수집과 별개 일정. 기간의 매일을 섬김일로 만든다 */
export async function createSpecialEvent(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as EventType;
  const title = String(formData.get("title") ?? "").trim();
  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date") || start);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!["retreat", "special"].includes(type) || !title || !start || end < start) redirect("/admin?error=event");

  const eventId = await transaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `insert into events (type, title, note, start_date, end_date) values ($1, $2, $3, $4, $5) returning id`,
      [type, title, note, start, end],
    );
    for (let d = start; d <= end; d = addDays(d, 1)) {
      await tx.query(`insert into event_days (event_id, date, kind) values ($1, $2, 'service')`, [rows[0].id, d]);
    }
    return rows[0].id;
  });

  revalidatePath("/admin");
  redirect(`/admin/events/${eventId}`);
}

/** 라인업 저장. 체크값은 'session:memberId' */
export async function saveLineup(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("event_id"));
  const intent = String(formData.get("intent") ?? "save");

  const picks = formData
    .getAll("assign")
    .map(String)
    .map((v) => v.split(":"))
    .filter(([session, memberId]) => isSession(session) && !!memberId);

  await transaction(async (tx) => {
    const sunOnly = new Set(
      (
        await tx.query<{ member_id: string }>(
          `select member_id from availabilities where event_id = $1 and status = 'sun_only'`,
          [eventId],
        )
      ).rows.map((r) => r.member_id),
    );
    await tx.query(`delete from lineup_assignments where event_id = $1`, [eventId]);
    for (const [session, memberId] of picks) {
      await tx.query(
        `insert into lineup_assignments (event_id, member_id, session, sat_absent) values ($1, $2, $3, $4)`,
        [eventId, memberId, session, sunOnly.has(memberId)],
      );
    }
    await tx.query(`delete from lineup_guests where event_id = $1`, [eventId]);
    for (const session of SESSIONS) {
      for (const name of parseGuestNames(String(formData.get(`guests:${session}`) ?? ""))) {
        await tx.query(`insert into lineup_guests (event_id, session, name) values ($1, $2, $3)`, [eventId, session, name]);
      }
    }
    if (intent === "confirm") {
      await tx.query(`update events set lineup_status = 'confirmed', confirmed_at = now() where id = $1`, [eventId]);
    }
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/calendar");
  redirect(`/admin/events/${eventId}?saved=${intent}`);
}

export async function unconfirmLineup(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await query(`update events set lineup_status = 'draft', confirmed_at = null where id = $1`, [eventId]);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/calendar");
}

/** 수련회·특별예배 일정을 지운다. 응답·라인업·게스트도 함께 지워진다 (주일 세트는 회차 삭제로) */
export async function deleteEvent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("event_id"));
  await query(`delete from events where id = $1 and round_id is null and type <> 'weekend'`, [id]);
  revalidatePath("/admin");
  revalidatePath("/calendar");
  revalidatePath("/availability");
  redirect("/admin?deleted=event");
}

/**
 * 회차의 편성 중인 주들을 파트별로 자동 배정한다. 확정된 주는 그대로 두고 횟수 계산에만 넣는다.
 * 편성 중인 주의 팀원 배정은 새로 채우고, 게스트는 남겨 둔다.
 */
export async function autoAssignRound(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("round_id"));
  const sessions = SIGNUP_SESSIONS.map((session) => {
    const n = Number(formData.get(`count:${session}`));
    return { session, count: Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), 5) : 1 };
  });

  await transaction(async (tx) => {
    const events = (
      await tx.query<{ id: string; lineup_status: string }>(
        `select id, lineup_status from events where round_id = $1 and type = 'weekend' order by start_date`,
        [roundId],
      )
    ).rows;
    const drafts = events.filter((e) => e.lineup_status === "draft");
    if (!drafts.length) return;

    const ids = events.map((e) => e.id);
    const answers = (
      await tx.query<{ event_id: string; member_id: string; status: string; sessions: Session[] }>(
        `select a.event_id, a.member_id, a.status, a.sessions
           from availabilities a join members m on m.id = a.member_id and m.status = 'approved'
          where a.event_id = any($1::uuid[]) and a.status <> 'none'`,
        [ids],
      )
    ).rows;
    const fixed = (
      await tx.query<{ event_id: string; member_id: string; session: Session }>(
        `select a.event_id, a.member_id, a.session
           from lineup_assignments a join events e on e.id = a.event_id
          where e.round_id = $1 and e.lineup_status = 'confirmed'`,
        [roundId],
      )
    ).rows;

    const rows = autoAssign({
      events: drafts,
      sessions,
      candidates: (eventId, session) =>
        answers.filter((a) => a.event_id === eventId && a.sessions.includes(session)).map((a) => a.member_id),
      fixed: fixed.map((f) => ({ eventId: f.event_id, memberId: f.member_id, session: f.session })),
    });

    const sunOnly = new Set(answers.filter((a) => a.status === "sun_only").map((a) => `${a.event_id}:${a.member_id}`));
    await tx.query(`delete from lineup_assignments where event_id = any($1::uuid[])`, [drafts.map((e) => e.id)]);
    for (const r of rows) {
      await tx.query(
        `insert into lineup_assignments (event_id, member_id, session, sat_absent) values ($1, $2, $3, $4)`,
        [r.eventId, r.memberId, r.session, sunOnly.has(`${r.eventId}:${r.memberId}`)],
      );
    }
  });

  revalidatePath(`/admin/rounds/${roundId}`);
  redirect(`/admin/rounds/${roundId}?saved=auto`);
}

/** 회차의 편성 중인 주를 한 번에 확정하고 공개한다 */
export async function confirmRound(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("round_id"));
  await query(
    `update events set lineup_status = 'confirmed', confirmed_at = now() where round_id = $1 and lineup_status = 'draft'`,
    [roundId],
  );
  revalidatePath(`/admin/rounds/${roundId}`);
  revalidatePath("/calendar");
  redirect(`/admin/rounds/${roundId}?saved=confirm`);
}
