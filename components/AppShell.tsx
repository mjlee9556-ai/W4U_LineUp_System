import Link from "next/link";
import type { Member } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { ChurchIcon, SettingsIcon } from "@/components/icons";

/**
 * 로그인한 화면의 틀: 위 머리글 + 아래 탭바.
 * 팀원 화면은 휴대폰 폭(max-w-md), 관리 화면은 표가 넓어 wide로 쓴다.
 */
export function AppShell({
  member,
  children,
  wide = false,
  title,
  action,
}: {
  member: Member;
  children: React.ReactNode;
  wide?: boolean;
  /** 머리글 가운데 대신 왼쪽에 크게 보일 화면 이름 (없으면 로고) */
  title?: string;
  /** 머리글 오른쪽에 더 넣을 것 */
  action?: React.ReactNode;
}) {
  const width = wide ? "max-w-5xl" : "max-w-md";
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${width}`}>
          <Link href="/calendar" className="flex min-w-0 items-center gap-2 text-navy-900">
            <ChurchIcon size={22} />
            <span className="truncate text-lg font-extrabold tracking-tight">{title ?? "J4U Worship"}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {action}
            {member.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                aria-label="관리"
              >
                <SettingsIcon size={18} />
                <span>관리</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pt-4 ${width}`}>{children}</main>
      <BottomNav />
    </div>
  );
}
