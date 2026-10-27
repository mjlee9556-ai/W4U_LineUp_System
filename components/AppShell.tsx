import Link from "next/link";
import type { Member } from "@/lib/types";

const NAV = [
  { href: "/calendar", label: "라인업" },
  { href: "/availability", label: "가능일자" },
  { href: "/me", label: "내 정보" },
];

export function AppShell({ member, children }: { member: Member; children: React.ReactNode }) {
  const nav = member.role === "admin" ? [...NAV, { href: "/admin", label: "관리" }] : NAV;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/calendar" className="font-semibold">
          J4U 찬양팀
        </Link>
        <nav className="-mx-3 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm sm:mx-0">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 hover:bg-stone-200">
              {item.label}
            </Link>
          ))}
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-1.5 text-stone-500 hover:bg-stone-200">로그아웃</button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
