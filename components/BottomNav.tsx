"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ListMusicIcon, UserIcon, UsersIcon } from "@/components/icons";

const TABS = [
  { href: "/calendar", label: "일정", Icon: CalendarIcon, match: ["/calendar", "/availability"] },
  { href: "/lineup", label: "라인업", Icon: UsersIcon, match: ["/lineup"] },
  { href: "/setlist", label: "콘티", Icon: ListMusicIcon, match: ["/setlist", "/events"] },
  { href: "/me", label: "마이", Icon: UserIcon, match: ["/me"] },
];

/** 화면 아래에 붙어 있는 탭바 */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match.some((m) => path === m || path.startsWith(`${m}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  active ? "text-navy-900" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.1 : 1.8} />
                {label}
                <span className={`h-1 w-1 rounded-full ${active ? "bg-accent-600" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
