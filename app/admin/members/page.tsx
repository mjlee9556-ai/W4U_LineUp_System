import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatPhone } from "@/lib/pin";
import { SESSION_LABELS, type Session } from "@/lib/sessions";
import type { Member } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { resetPin, setMemberRole, setMemberStatus } from "../actions";

const STATUS_LABEL = { approved: "활동", pending: "승인 대기", inactive: "비활성" } as const;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { member: me } = await requireAdmin();
  const { error } = await searchParams;
  const flash = (await cookies()).get("j4u_flash_pin")?.value;
  const { name: resetName, pin: resetPinValue } = flash ? (JSON.parse(flash) as { name: string; pin: string }) : { name: "", pin: "" };

  const members = await query<Member & { sessions: Session[] }>(
    `select m.id, m.name, m.phone, m.district, m.dong, m.role, m.status, m.birth_date, m.email,
            coalesce(array(select session from member_sessions s where s.member_id = m.id), '{}') as sessions
       from members m order by m.status, m.name`,
  );

  return (
    <AppShell member={me}>
      <Link href="/admin" className="text-sm text-stone-500 hover:underline">← 관리</Link>
      <h1 className="mt-2 text-xl font-bold">팀원 관리</h1>
      <div className="mt-4">
        <Notice message={resetPinValue ? `${resetName}님의 임시 PIN은 ${resetPinValue}이에요. 본인에게 전달해 주세요. 1분 뒤에는 다시 볼 수 없어요.` : undefined} />
        <Notice tone="error" message={error === "self" ? "본인의 관리자 권한은 직접 해제할 수 없어요." : undefined} />
      </div>

      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <div className="font-medium">
                {m.name}
                {m.role === "admin" && <span className="ml-1 rounded bg-stone-900 px-1.5 text-xs text-white">관리자</span>}
                <span className="ml-1 text-xs text-stone-500">{STATUS_LABEL[m.status]}</span>
              </div>
              <div className="text-xs text-stone-500">
                {formatPhone(m.phone)} · {m.sessions.map((s) => SESSION_LABELS[s]).join(", ")} · {m.district} {m.dong}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <form action={resetPin}>
                <input type="hidden" name="member_id" value={m.id} />
                <SubmitButton className="btn-secondary px-3 py-1 text-xs" pendingText="…">PIN 초기화</SubmitButton>
              </form>
              <form action={setMemberRole}>
                <input type="hidden" name="member_id" value={m.id} />
                <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                <SubmitButton className="btn-secondary px-3 py-1 text-xs" pendingText="…">
                  {m.role === "admin" ? "관리자 해제" : "관리자 지정"}
                </SubmitButton>
              </form>
              <form action={setMemberStatus}>
                <input type="hidden" name="member_id" value={m.id} />
                <input type="hidden" name="status" value={m.status === "approved" ? "inactive" : "approved"} />
                <SubmitButton className="btn-secondary px-3 py-1 text-xs" pendingText="…">
                  {m.status === "approved" ? "비활성화" : "승인"}
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
