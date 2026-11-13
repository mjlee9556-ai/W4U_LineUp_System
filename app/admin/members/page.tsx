import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatPhone, PIN_PATTERN } from "@/lib/pin";
import { SESSION_LABELS, type Session } from "@/lib/sessions";
import { formatAddress, type Member } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { PhoneInput } from "@/components/PhoneInput";
import { RoleChip } from "@/components/RoleChip";
import { SubmitButton } from "@/components/SubmitButton";
import { ArrowLeftIcon, HelpIcon, MapPinIcon, PencilIcon, SearchIcon, UserPlusIcon } from "@/components/icons";
import { deleteMember, resetPin, setMemberRole, setMemberStatus, updateMemberCredentials } from "../actions";

const STATUS = {
  approved: { label: "활동", tone: "border-sage-200 bg-sage-50 text-sage-700", dot: "bg-emerald-500" },
  pending: { label: "승인 대기", tone: "border-gold-300 bg-gold-50 text-gold-700", dot: "bg-gold-500" },
  inactive: { label: "비활성", tone: "border-stone-200 bg-stone-100 text-stone-500", dot: "bg-stone-400" },
} as const;

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "admin", label: "관리자" },
  { key: "member", label: "일반 팀원" },
  { key: "inactive", label: "비활성" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const ERRORS: Record<string, string> = {
  self: "본인의 관리자 권한은 직접 해제할 수 없어요.",
  "self-delete": "본인 계정은 삭제할 수 없어요.",
  phone: "전화번호를 - 없이 숫자만 정확히 입력해 주세요. (예: 01012345678)",
  "phone-taken": "이미 다른 팀원이 쓰는 전화번호예요.",
  pin: "PIN은 숫자 4~6자리로 입력해 주세요.",
};

type Row = Member & { sessions: Session[] };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string; updated?: string; pin?: string; edit?: string; q?: string; f?: string }>;
}) {
  const { member: me } = await requireAdmin();
  const { error, deleted, updated, pin, edit, q = "", f } = await searchParams;
  const filter: FilterKey = FILTERS.some((x) => x.key === f) ? (f as FilterKey) : "all";
  const flash = (await cookies()).get("j4u_flash_pin")?.value;
  const { name: resetName, pin: resetPinValue } = flash ? (JSON.parse(flash) as { name: string; pin: string }) : { name: "", pin: "" };

  const [members, invite] = await Promise.all([
    query<Row>(
      `select m.id, m.name, m.phone, m.district, m.dong, m.role, m.status, m.birth_date, m.email,
              coalesce(array(select session from member_sessions s where s.member_id = m.id), '{}') as sessions
         from members m order by m.status, m.role, m.name`,
    ),
    // 지금 쓸 수 있는 가장 최근 초대코드 (신규 팀원 초대 버튼용)
    queryOne<{ code: string }>(
      `select code from invite_codes
        where (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses)
        order by created_at desc limit 1`,
    ),
  ]);

  const counts: Record<FilterKey, number> = {
    all: members.length,
    admin: members.filter((m) => m.role === "admin").length,
    member: members.filter((m) => m.role === "member").length,
    inactive: members.filter((m) => m.status === "inactive").length,
  };
  const activeCount = members.filter((m) => m.status === "approved").length;
  const needle = q.trim().toLowerCase();
  const shown = members.filter((m) => {
    if (filter === "admin" && m.role !== "admin") return false;
    if (filter === "member" && m.role !== "member") return false;
    if (filter === "inactive" && m.status !== "inactive") return false;
    if (!needle) return true;
    const hay = [m.name, m.phone, formatAddress(m), ...m.sessions.map((s) => SESSION_LABELS[s])].join(" ").toLowerCase();
    return hay.includes(needle);
  });
  const filterHref = (key: FilterKey) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("f", key);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/admin/members${s ? `?${s}` : ""}`;
  };

  return (
    <AppShell member={me}>
      <div className="space-y-4">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-ink-900">
            <ArrowLeftIcon size={15} />
            관리 메뉴로 이동
          </Link>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <h1 className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight text-ink-900">
              팀원 관리
              <span className="rounded-md bg-ink-900 px-2 py-0.5 text-xs font-bold text-white">관리자 모드</span>
            </h1>
            <span className="shrink-0 pb-1 text-[13px] text-stone-500">
              총 <b className="text-ink-900">{members.length}</b>명 (활동 {activeCount})
            </span>
          </div>
        </div>

        <Notice message={resetPinValue ? `${resetName}님의 임시 PIN은 ${resetPinValue}이에요. 본인에게 전달해 주세요. 1분 뒤에는 다시 볼 수 없어요.` : undefined} />
        <Notice message={deleted ? `${deleted}님의 계정을 삭제했어요.` : undefined} />
        <Notice
          message={
            updated !== undefined
              ? `${updated}님의 전화번호${pin ? "와 PIN" : ""}을 저장했어요.${pin ? " 바뀐 PIN으로 다시 로그인해야 해요." : ""}`
              : undefined
          }
        />
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />

        {/* 검색 */}
        <form action="/admin/members" className="relative">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="팀원 이름, 악기 세션, 거주지 검색"
            aria-label="팀원 검색"
            className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-[14px] text-stone-900 placeholder:text-stone-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={filterHref(x.key)}
              aria-current={filter === x.key ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-[13px] font-bold transition ${
                filter === x.key ? "border-ink-900 bg-ink-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {x.label} {counts[x.key]}
            </Link>
          ))}
        </div>

        {/* 신규 팀원 초대 */}
        <section className="flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-[0_8px_24px_-6px_rgba(27,36,56,0.35)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-300">
            <UserPlusIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold">신규 팀원 합류 초대</h2>
            <p className="truncate text-xs text-white/70">
              {invite ? "가입 링크를 복사해 단톡방에 전달하세요" : "쓸 수 있는 초대코드가 없어요"}
            </p>
          </div>
          {invite ? (
            <CopyButton
              path={`/signup?code=${invite.code}`}
              label="초대 링크 복사"
              className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
            />
          ) : (
            <Link href="/admin#invite" className="shrink-0 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25">
              코드 만들기
            </Link>
          )}
        </section>

        {/* 팀원 카드 */}
        <div className="space-y-3">
          {shown.map((m) => {
            const status = STATUS[m.status];
            const isAdmin = m.role === "admin";
            return (
              <article id={`m-${m.id}`} key={m.id} className="scroll-mt-20 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${
                      isAdmin ? "bg-ink-900 text-white" : "border border-stone-200 bg-stone-50 text-ink-900"
                    }`}
                  >
                    {m.name.trim().slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[17px] font-extrabold text-ink-900">{m.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          isAdmin ? "bg-ink-900 text-gold-300" : "border border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {isAdmin ? "관리자" : "팀원"}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${status.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[13px] tracking-wide text-stone-600">{formatPhone(m.phone)}</div>
                  </div>
                  {m.sessions[0] && (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <RoleChip session={m.sessions[0]} />
                      {m.sessions.length > 1 && <span className="text-[10px] text-stone-400">외 {m.sessions.length - 1}개</span>}
                    </span>
                  )}
                </div>

                {formatAddress(m) && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-stone-50 px-3 py-2 text-[13px] text-stone-600">
                    <MapPinIcon size={14} className="shrink-0 text-stone-400" />
                    {formatAddress(m)}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-stone-100 pt-3">
                  <form action={resetPin}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <SubmitButton className={ACTION} pendingText="…">PIN 초기화</SubmitButton>
                  </form>
                  <form action={setMemberRole}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="role" value={isAdmin ? "member" : "admin"} />
                    <SubmitButton className={ACTION} pendingText="…">{isAdmin ? "관리자 해제" : "관리자 지정"}</SubmitButton>
                  </form>
                  <form action={setMemberStatus}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="status" value={m.status === "approved" ? "inactive" : "approved"} />
                    <SubmitButton className={ACTION} pendingText="…">{m.status === "approved" ? "비활성화" : "승인"}</SubmitButton>
                  </form>
                  {m.id !== me.id && (
                    <form action={deleteMember}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <ConfirmSubmitButton
                        confirmMessage={[
                          `${m.name}님의 계정을 삭제할까요?`,
                          "• 가능일자 응답과 아직 확정 전인 라인업 배정은 함께 지워져요.\n• 이미 확정된 라인업에는 이름만 '게스트'로 남아 캘린더 기록이 유지돼요.\n• 다시 쓰려면 새로 가입해야 해요.",
                          "삭제하면 되돌릴 수 없어요. 잠시 쉬는 거라면 '비활성화'를 써 주세요.",
                        ].join("\n\n")}
                        pendingText="…"
                        className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        계정 삭제
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>

                {/* 전화번호·PIN 직접 수정 */}
                <details className="group mt-2" open={edit === m.id || undefined}>
                  <summary className="flex cursor-pointer list-none items-center justify-end gap-1 text-xs font-semibold text-stone-500 hover:text-ink-900 [&::-webkit-details-marker]:hidden">
                    <PencilIcon size={12} />
                    전화번호·PIN 수정
                  </summary>
                  <form action={updateMemberCredentials} className="mt-2 space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <input type="hidden" name="member_id" value={m.id} />
                    <div>
                      <label htmlFor={`phone-${m.id}`} className="mb-1 block text-xs font-bold text-stone-700">
                        전화번호 (로그인 아이디)
                      </label>
                      <PhoneInput id={`phone-${m.id}`} defaultValue={m.phone} className={FIELD} />
                    </div>
                    <div>
                      <label htmlFor={`pin-${m.id}`} className="mb-1 block text-xs font-bold text-stone-700">
                        새 PIN <span className="font-normal text-stone-400">(바꾸지 않으려면 비워 두세요)</span>
                      </label>
                      <input
                        id={`pin-${m.id}`}
                        name="pin"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        pattern={PIN_PATTERN}
                        maxLength={6}
                        title="숫자 4~6자리"
                        placeholder="숫자 4~6자리"
                        className={`${FIELD} font-mono tracking-widest`}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-500">
                      PIN을 바꾸면 로그인 잠금이 풀리고, 그 팀원은 새 PIN으로 다시 로그인해야 해요. 정한 PIN은 본인에게 직접 전달해 주세요.
                    </p>
                    <div className="flex justify-end">
                      <SubmitButton className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-bold text-white hover:bg-navy-800 disabled:opacity-60">
                        저장
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              </article>
            );
          })}
          {shown.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">
              조건에 맞는 팀원이 없어요.
            </p>
          )}
        </div>

        <section className="rounded-2xl border border-stone-200 bg-stone-100/70 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
            <HelpIcon size={16} />
            팀원 관리 가이드
          </h2>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-stone-600">
            <li>
              · <b className="text-ink-900">PIN 초기화</b>는 숫자 4자리 임시 PIN을 무작위로 만들어 1분 동안 보여 줘요. 본인에게 전달해 주세요.
            </li>
            <li>
              · <b className="text-ink-900">전화번호·PIN 수정</b>으로 번호가 바뀐 팀원의 로그인 아이디나 PIN을 직접 정할 수 있어요.
            </li>
            <li>
              · <b className="text-ink-900">관리자 지정</b> 시 회차·라인업 편성, 콘티 편집, 가입 승인 등 관리 메뉴 전체 권한이 생겨요.
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

const ACTION =
  "rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60";
const FIELD =
  "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10 focus:outline-none";
