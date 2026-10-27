import Link from "next/link";
import type { Member } from "@/lib/types";

const NAV = [
  { href: "/calendar", label: "라인업" },
  { href: "/availability", label: "가능일자" },
];

export function AppShell({ member, children }: { member: Member; children: React.ReactNode }) {
  const nav = member.role === "admin" ? [...NAV, { href: "/admin", label: "관리" }] : NAV;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Link href="/calendar" className="font-semibold">
          J4U 찬양팀
        </Link>
        <nav className="flex items-center gap-1 text-sm">
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
