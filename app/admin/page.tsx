import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { addDays, formatMonth, formatShort, shiftMonth, todayKST } from "@/lib/dates";
import { SESSION_LABELS, type Session } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, formatAddress, type LineupEvent, type Member, type Round } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SubmitButton } from "@/components/SubmitButton";
import { DEFAULT_COMMUNION_NOTICE, getSetting } from "@/lib/setlist";
import { saveCommunionNotice } from "../events/[id]/actions";
import { createInviteCode, createRound, createSpecialEvent, deleteEvent, deleteInviteCode, setMemberStatus } from "./actions";

const ERRORS: Record<string, string> = {
  month: "월을 다시 골라 주세요.",
  round: "회차를 만들지 못했어요. 같은 달 회차가 이미 있는지 확인해 주세요.",
  closes: "마감일은 오늘 이후로 골라 주세요.",
  event: "일정 정보를 다시 확인해 주세요.",
};

type InviteCode = { code: string; expires_at: string | null; max_uses: number | null; used_count: number };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string; saved?: string }> }) {
  const { member } = await requireAdmin();
  const { error, deleted, saved } = await searchParams;

  const [pending, codes, rounds, specials, [{ count: approvedCount }]] = await Promise.all([
    query<Member & { sessions: Session[] }>(
      `select m.id, m.name, m.district, m.dong, m.created_at,
              coalesce(array(select session from member_sessions s where s.member_id = m.id), '{}') as sessions
         from members m where m.status = 'pending' order by m.created_at`,
    ),
    query<InviteCode>(`select * from invite_codes order by created_at desc`),
    query<Round>(`select * from availability_rounds order by target_month desc limit 6`),
    query<LineupEvent>(`select * from events where round_id is null and end_date >= $1 order by start_date`, [todayKST()]),
    query<{ count: number }>(`select count(*)::int as count from members where status = 'approved'`),
  ]);
  const communionNotice = await getSetting("communion_notice", DEFAULT_COMMUNION_NOTICE);

  const nextMonth = shiftMonth(todayKST().slice(0, 7), 1);

  return (
    <AppShell member={member}>
      <h1 className="text-xl font-bold">관리</h1>
      <p className="mt-1 text-sm text-stone-600">
        승인된 팀원 {approvedCount}명 · <Link href="/admin/members" className="underline">팀원 관리 (PIN 초기화·관리자 지정)</Link>
      </p>
      <div className="mt-4">
        <Notice
          message={
            deleted === "round"
              ? "회차를 삭제했어요."
              : deleted === "event"
                ? "일정을 삭제했어요."
                : saved === "notice"
                  ? "성찬식 공지를 저장했어요."
                  : undefined
          }
        />
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">가능일자 수집 회차</h2>
          <form action={createRound} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="month">대상 월</label>
              <input id="month" name="month" type="month" required defaultValue={nextMonth} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="closes_on">마감일</label>
              <input id="closes_on" name="closes_on" type="date" defaultValue={defaultClosesOn(todayKST())} className="input" />
            </div>
            <SubmitButton pendingText="여는 중…">회차 열기</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-stone-500">그 달의 일요일마다 토 연습 + 일 예배 세트가 자동으로 생겨요.</p>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {rounds.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/admin/rounds/${r.id}`} className="underline-offset-2 hover:underline">
                  {formatMonth(r.target_month.slice(0, 7))}
                </Link>
                <span className="text-xs text-stone-500">
                  {r.status === "open" ? "수집 중" : "마감"}
                  {r.closes_at && ` · ${formatShort(r.closes_at.slice(0, 10))}까지`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="font-semibold">수련회·특별예배</h2>
          <form action={createSpecialEvent} className="mt-3 grid grid-cols-2 gap-2">
            <select name="type" className="input" defaultValue="special">
              <option value="special">특별예배</option>
              <option value="retreat">수련회</option>
            </select>
            <input name="title" required placeholder="예: 성탄 예배" className="input" />
            <input name="start_date" type="date" required className="input" aria-label="시작일" />
            <input name="end_date" type="date" className="input" aria-label="종료일(하루면 비움)" />
            <input name="note" placeholder="메모 (연습 일정 등)" className="input col-span-2" />
            <SubmitButton className="btn-primary col-span-2" pendingText="추가 중…">일정 추가</SubmitButton>
          </form>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {specials.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <Link href={`/admin/events/${e.id}`} className="hover:underline">
                  {e.title} <span className="text-xs text-stone-500">{EVENT_TYPE_LABELS[e.type]}</span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-stone-500">
                  {formatShort(e.start_date)}
                  {e.end_date !== e.start_date && `~${formatShort(e.end_date)}`} · {e.lineup_status === "confirmed" ? "확정" : "편성 중"}
                  <form action={deleteEvent}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`'${e.title}' 일정을 삭제할까요?\n\n팀원 응답과 라인업도 함께 지워지고 되돌릴 수 없어요.`}
                      pendingText="…"
                      className="text-red-600 hover:underline"
                    >
                      삭제
                    </ConfirmSubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="font-semibold">가입 승인 대기 {pending.length ? `(${pending.length})` : ""}</h2>
          {!pending.length && <p className="mt-2 text-sm text-stone-500">대기 중인 사람이 없어요.</p>}
          <ul className="mt-2 divide-y divide-stone-100">
            {pending.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-stone-500">
                    {m.sessions.map((s) => SESSION_LABELS[s]).join(", ")} · {formatAddress(m)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <form action={setMemberStatus}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="status" value="approved" />
                    <SubmitButton className="btn-primary px-3 py-1" pendingText="…">승인</SubmitButton>
                  </form>
                  <form action={setMemberStatus}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="status" value="inactive" />
                    <SubmitButton className="btn-secondary px-3 py-1" pendingText="…">거절</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="font-semibold">초대코드</h2>
          <form action={createInviteCode} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="max_uses">사용 횟수</label>
              <input id="max_uses" name="max_uses" type="number" min={1} placeholder="무제한" className="input w-28" />
            </div>
            <div>
              <label className="label" htmlFor="expires_days">유효 기간(일)</label>
              <input id="expires_days" name="expires_days" type="number" min={1} defaultValue={14} className="input w-28" />
            </div>
            <SubmitButton pendingText="만드는 중…">코드 만들기</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-stone-500">가입 링크를 단톡방에 공유하면 초대코드가 미리 채워져서, 가입하자마자 바로 승인돼요.</p>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {codes.map((c) => (
              <li key={c.code} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{c.code}</span>
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    {c.used_count}/{c.max_uses ?? "∞"}회
                    {c.expires_at && ` · ${formatShort(c.expires_at.slice(0, 10))}까지`}
                    <form action={deleteInviteCode}>
                      <input type="hidden" name="code" value={c.code} />
                      <button className="text-red-600 hover:underline">삭제</button>
                    </form>
                  </span>
                </div>
                <CopyLinkButton path={`/signup?code=${c.code}`} />
              </li>
            ))}
          </ul>
        </section>
        <section className="card md:col-span-2">
          <h2 className="font-semibold">성찬식 주일 공지</h2>
          <p className="mt-1 text-xs text-stone-500">매월 첫째 주일에 캘린더와 주차 화면에 &apos;성찬식&apos; 표시와 함께 나와요. 비우고 저장하면 기본 문구로 돌아가요.</p>
          <form action={saveCommunionNotice} className="mt-3 flex gap-2">
            <input name="notice" defaultValue={communionNotice} maxLength={200} aria-label="성찬식 공지" className="input" />
            <SubmitButton className="btn-primary shrink-0">저장</SubmitButton>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

// 보통 25일 마감, 이미 지났으면 사흘 뒤
function defaultClosesOn(today: string) {
  const usual = `${today.slice(0, 7)}-25`;
  return today < usual ? usual : addDays(today, 3);
}
