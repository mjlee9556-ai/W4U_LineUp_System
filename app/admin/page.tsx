import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { addDays, formatMonth, formatShort, shiftMonth, todayKST } from "@/lib/dates";
import { SESSION_LABELS, type Session } from "@/lib/sessions";
import { canApproveSignups, EVENT_TYPE_LABELS, formatAddress, roleLabel, type LineupEvent, type Member, type Round } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import {
  CalendarPlusIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  InfoIcon,
  KeyIcon,
  MegaphoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCheckIcon,
} from "@/components/icons";
import { DEFAULT_COMMUNION_NOTICE, getSetting } from "@/lib/setlist";
import { saveCommunionNotice } from "../events/[id]/actions";
import { createInviteCode, createRound, createSpecialEvent, deleteEvent, deleteInviteCode, setMemberStatus } from "./actions";

const ERRORS: Record<string, string> = {
  month: "월을 다시 골라 주세요.",
  round: "회차를 만들지 못했어요. 같은 달 회차가 이미 있는지 확인해 주세요.",
  closes: "마감일은 오늘 이후로 골라 주세요.",
  event: "일정 정보를 다시 확인해 주세요.",
  approve: "가입 승인·거절은 최종 관리자와 찬양팀장만 할 수 있어요.",
};

type InviteCode = { code: string; expires_at: string | null; max_uses: number | null; used_count: number };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string; saved?: string }> }) {
  const { member } = await requireAdmin();
  const { error, deleted, saved } = await searchParams;
  const approver = canApproveSignups(member);

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
    <AppShell
      member={member}
      back={{ href: "/calendar", label: "J4U Worship" }}
      action={
        <span className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-bold text-ink-900">
          <ShieldCheckIcon size={15} />
          {roleLabel(member)}
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">관리자 관리 메뉴</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-stone-500">
            승인된 팀원 <b className="text-ink-900">{approvedCount}명</b>
            <span className="text-stone-300">·</span>
            <Link href="/admin/members" className="inline-flex items-center gap-0.5 font-semibold text-ink-900 underline underline-offset-2 hover:text-navy-700">
              팀원 관리 (계정·직함 관리)
              <ChevronRightIcon size={14} />
            </Link>
          </p>
        </div>

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

        {/* 가능일자 수집 회차 */}
        <Card
          icon={<CalendarPlusIcon size={19} />}
          tone="bg-ink-50 text-ink-900"
          title="가능일자 수집 회차"
          badge={<span className="rounded-md bg-sage-50 px-2 py-0.5 text-[11px] font-bold text-sage-700">자동 생성 지원</span>}
        >
          <form action={createRound} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL} htmlFor="month">대상 월</label>
                <input id="month" name="month" type="month" required defaultValue={nextMonth} className={FIELD} />
              </div>
              <div>
                <label className={LABEL} htmlFor="closes_on">마감일</label>
                <input id="closes_on" name="closes_on" type="date" defaultValue={defaultClosesOn(todayKST())} className={FIELD} />
              </div>
            </div>
            <SubmitButton pendingText="여는 중…" className={PRIMARY}>
              <PlusIcon size={17} strokeWidth={2.4} />
              회차 열기
            </SubmitButton>
          </form>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-700">
            <InfoIcon size={14} className="shrink-0" />그 달의 일요일마다 토 연습 + 일 예배 세트가 자동으로 생겨요.
          </p>
          {rounds.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3">
              {rounds.map((r) => {
                const open = r.status === "open";
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/rounds/${r.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5 hover:bg-stone-100"
                    >
                      <span className={`flex items-center gap-2 text-sm ${open ? "font-bold text-ink-900" : "font-semibold text-stone-600"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-stone-400"}`} />
                        {formatMonth(r.target_month.slice(0, 7))}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          open ? "border-sky-200 bg-sky-50 text-sky-800" : "border-stone-200 bg-white text-stone-500"
                        }`}
                      >
                        {open ? "수집 중" : "마감"}
                        {r.closes_at && ` · ${formatShort(r.closes_at.slice(0, 10))}까지`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* 수련회·특별예배 */}
        <Card icon={<SparklesIcon size={19} />} tone="bg-gold-50 text-gold-700" title="수련회 · 특별예배">
          <form action={createSpecialEvent} className="space-y-3">
            <div className="grid grid-cols-[2fr_3fr] gap-2">
              <div>
                <label className={LABEL} htmlFor="type">구분</label>
                <select id="type" name="type" className={FIELD} defaultValue="special">
                  <option value="special">특별예배</option>
                  <option value="retreat">수련회</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="title">행사명</label>
                <input id="title" name="title" required placeholder="예: 성탄 축하 예배" className={FIELD} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL} htmlFor="start_date">시작일</label>
                <input id="start_date" name="start_date" type="date" required className={FIELD} />
              </div>
              <div>
                <label className={LABEL} htmlFor="end_date">종료일 <span className="font-normal text-stone-400">(하루면 비움)</span></label>
                <input id="end_date" name="end_date" type="date" className={FIELD} />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="note">상세 메모</label>
              <input id="note" name="note" placeholder="메모 (연습 일정, 악기 편성 등)" className={FIELD} />
            </div>
            <SubmitButton className={PRIMARY} pendingText="추가 중…">
              <CheckCircleIcon size={17} />
              일정 추가
            </SubmitButton>
          </form>
          {specials.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3">
              {specials.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
                  <Link href={`/admin/events/${e.id}`} className="min-w-0 hover:underline">
                    <span className="font-bold text-ink-900">{e.title}</span>{" "}
                    <span className="text-xs text-stone-500">{EVENT_TYPE_LABELS[e.type]}</span>
                    <div className="text-xs text-stone-500">
                      {formatShort(e.start_date)}
                      {e.end_date !== e.start_date && `~${formatShort(e.end_date)}`} · {e.lineup_status === "confirmed" ? "확정" : "편성 중"}
                    </div>
                  </Link>
                  <form action={deleteEvent}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`'${e.title}' 일정을 삭제할까요?\n\n팀원 응답과 라인업도 함께 지워지고 되돌릴 수 없어요.`}
                      pendingText="…"
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 가입 승인 대기 */}
        <Card
          icon={<UserCheckIcon size={19} />}
          tone="bg-sky-50 text-sky-800"
          title="가입 승인 대기"
          badge={
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pending.length ? "bg-ember-50 text-ember-600" : "bg-stone-100 text-stone-500"}`}>
              {pending.length}명
            </span>
          }
        >
          {!approver && pending.length > 0 && (
            <p className="mb-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">가입 승인·거절은 최종 관리자와 찬양팀장이 할 수 있어요.</p>
          )}
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 py-7 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                <CheckCircleIcon size={20} />
              </span>
              <p className="text-sm font-bold text-ink-900">대기 중인 사람이 없어요.</p>
              <p className="text-xs text-stone-500">새로운 팀원이 가입을 신청하면 이곳에 표시돼요.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold text-ink-900">{m.name}</div>
                    <div className="truncate text-xs text-stone-500">
                      {m.sessions.map((s) => SESSION_LABELS[s]).join(", ")}
                      {formatAddress(m) && ` · ${formatAddress(m)}`}
                    </div>
                  </div>
                  {approver && (
                  <div className="flex shrink-0 gap-1">
                    <form action={setMemberStatus}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <input type="hidden" name="status" value="approved" />
                      <SubmitButton className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-800" pendingText="…">
                        승인
                      </SubmitButton>
                    </form>
                    <form action={setMemberStatus}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <input type="hidden" name="status" value="inactive" />
                      <SubmitButton className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50" pendingText="…">
                        거절
                      </SubmitButton>
                    </form>
                  </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 초대코드 */}
        <Card id="invite" icon={<KeyIcon size={19} />} tone="bg-violet-50 text-violet-700" title="초대코드 생성">
          <form action={createInviteCode} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div>
              <label className={LABEL} htmlFor="max_uses">사용 횟수</label>
              <input id="max_uses" name="max_uses" type="number" min={1} placeholder="무제한" className={`${FIELD} text-center`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="expires_days">유효 기간(일)</label>
              <input id="expires_days" name="expires_days" type="number" min={1} defaultValue={14} className={`${FIELD} text-center`} />
            </div>
            <SubmitButton pendingText="…" className="h-11 rounded-xl bg-ink-900 px-4 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
              코드 만들기
            </SubmitButton>
          </form>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            가입 링크를 단톡방에 공유하면 초대코드가 미리 채워져서, 가입하자마자 바로 승인돼요.
          </p>
          {codes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {codes.map((c) => (
                <li key={c.code} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">발급코드</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-wider text-ink-900">{c.code}</span>
                    <CopyButton
                      path={`/signup?code=${c.code}`}
                      label="링크 복사"
                      className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>
                      사용 {c.used_count}/{c.max_uses ?? "∞"}회
                      {c.expires_at && ` · ${formatShort(c.expires_at.slice(0, 10))}까지`}
                    </span>
                    <form action={deleteInviteCode}>
                      <input type="hidden" name="code" value={c.code} />
                      <button className="font-semibold text-red-600 hover:underline">삭제</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 성찬식 공지 */}
        <Card icon={<MegaphoneIcon size={19} />} tone="bg-red-50 text-red-700" title="성찬식 주일 공지">
          <p className="mb-3 text-xs leading-relaxed text-stone-500">
            매월 첫째 주일에 캘린더와 주차 화면에 &apos;성찬식&apos; 표시와 함께 나와요. 비우고 저장하면 기본 문구로 돌아가요.
          </p>
          <form action={saveCommunionNotice} className="flex gap-2">
            <input name="notice" defaultValue={communionNotice} maxLength={200} aria-label="성찬식 공지" className={FIELD} />
            <SubmitButton className="h-11 shrink-0 rounded-xl bg-ink-900 px-4 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
              저장
            </SubmitButton>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

function Card({
  id,
  icon,
  tone,
  title,
  badge,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <h2 className="flex items-center gap-2.5 text-[16px] font-extrabold text-ink-900">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

const LABEL = "mb-1 block text-xs font-semibold text-stone-600";
const FIELD =
  "h-11 w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10 focus:outline-none";
const PRIMARY =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-sm font-bold text-white shadow-sm hover:bg-navy-800 disabled:opacity-60";

// 보통 25일 마감, 이미 지났으면 사흘 뒤
function defaultClosesOn(today: string) {
  const usual = `${today.slice(0, 7)}-25`;
  return today < usual ? usual : addDays(today, 3);
}
