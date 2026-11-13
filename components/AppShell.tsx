import Link from "next/link";
import { isAdmin, type Member } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon, ChurchIcon, SettingsIcon } from "@/components/icons";

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
  back,
}: {
  member: Member;
  children: React.ReactNode;
  wide?: boolean;
  /** 머리글 가운데 대신 왼쪽에 크게 보일 화면 이름 (없으면 로고) */
  title?: string;
  /** 머리글 오른쪽에 더 넣을 것 */
  action?: React.ReactNode;
  /** 있으면 로고 자리에 뒤로 가기 화살표를 둔다 */
  back?: { href: string; label: string };
}) {
  const width = wide ? "max-w-5xl" : "max-w-md";
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${width}`}>
          {back ? (
            <div className="flex min-w-0 items-center gap-1 text-ink-900">
              <Link
                href={back.href}
                aria-label={`${back.label}(으)로 돌아가기`}
                className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"
              >
                <ArrowLeftIcon size={22} />
              </Link>
              <span className="truncate text-[17px] font-extrabold tracking-tight">{title ?? back.label}</span>
            </div>
          ) : (
            <Link href="/calendar" className="flex min-w-0 items-center gap-2 text-navy-900">
              <ChurchIcon size={22} />
              <span className="truncate text-lg font-extrabold tracking-tight">{title ?? "J4U Worship"}</span>
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {action}
            {isAdmin(member) && !back && (
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
