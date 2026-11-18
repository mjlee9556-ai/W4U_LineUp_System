"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BOARD_COLUMNS, type BoardCell, type BoardPerson } from "@/lib/board";
import { SESSION_SHORT, type Session } from "@/lib/sessions";
import { toggleBoardAssignment } from "@/app/admin/actions";
import { SESSION_TONE } from "@/components/RoleChip";
import { CheckIcon, LockIcon } from "@/components/icons";

export type BoardWeek = {
  id: string;
  label: string; // '1주'
  date: string; // '12/7'
  practice: boolean;
  confirmed: boolean;
  cells: BoardCell[];
};

const cellKey = (eventId: string, session: Session, memberId: string) => `${eventId}:${session}:${memberId}`;

/**
 * 월간 배정표: 주차(행) × 세션(열).
 * 칸마다 그 주 그 세션에 가능하다고 체크한 사람이 흐리게 보이고, 누르면 배정(진하게), 다시 누르면 해제된다.
 */
export function LineupBoardGrid({ weeks }: { weeks: BoardWeek[] }) {
  // 서버 응답이 오기 전에 화면을 먼저 바꿔 둔다 (key → 배정 여부)
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isAssigned = (eventId: string, session: Session, p: BoardPerson) =>
    p.memberId ? (pending[cellKey(eventId, session, p.memberId)] ?? p.assigned) : p.assigned;

  function toggle(week: BoardWeek, session: Session, p: BoardPerson) {
    if (!p.memberId || week.confirmed) return;
    const key = cellKey(week.id, session, p.memberId);
    const next = !isAssigned(week.id, session, p);
    setError(null);
    setPending((s) => ({ ...s, [key]: next }));
    startTransition(async () => {
      try {
        const res = await toggleBoardAssignment({ eventId: week.id, memberId: p.memberId!, session, assign: next });
        if (!res.ok) setError(res.error);
      } catch {
        setError("저장하지 못했어요. 다시 눌러 주세요.");
      }
      // 서버가 새 표를 내려주면 그 값을 따른다 (실패했으면 원래대로 돌아간다)
      setPending((s) => {
        const rest = { ...s };
        delete rest[key];
        return rest;
      });
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] w-[68px] rounded-tl-xl border-b border-stone-200 bg-stone-50 px-2 py-2.5 text-left text-[11px] font-bold text-stone-500">
                주차
              </th>
              {BOARD_COLUMNS.map((c, i) => (
                <th
                  key={c.session}
                  className={`border-b border-stone-200 bg-stone-50 px-1.5 py-2.5 text-center text-[12px] font-extrabold text-ink-900 ${
                    i === BOARD_COLUMNS.length - 1 ? "rounded-tr-xl" : ""
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              // 이 주에 이미 다른 세션으로 배정된 사람 (한 사람은 보통 한 주에 한 파트만 맡는다)
              const assignedIn = new Map<string, Session[]>();
              for (const cell of week.cells)
                for (const p of cell.people)
                  if (p.memberId && isAssigned(week.id, cell.session, p))
                    assignedIn.set(p.memberId, [...(assignedIn.get(p.memberId) ?? []), cell.session]);
              return (
                <tr key={week.id} className={week.confirmed ? "bg-sage-50/40" : ""}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-[1] border-b border-stone-100 px-2 py-2.5 text-left align-top ${week.confirmed ? "bg-sage-50" : "bg-white"}`}
                  >
                    <Link href={`/admin/events/${week.id}`} className="block hover:underline">
                      <span className="block text-[15px] font-extrabold text-ink-900">{week.label}</span>
                      <span className="block text-[11px] font-semibold text-stone-500">{week.date}</span>
                    </Link>
                    {week.confirmed ? (
                      <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sage-50 px-1.5 py-0.5 text-[10px] font-bold text-sage-700">
                        <LockIcon size={10} />
                        확정
                      </span>
                    ) : (
                      !week.practice && <span className="mt-1 block text-[10px] font-semibold text-gold-700">토 연습 없음</span>
                    )}
                  </th>
                  {week.cells.map((cell) => (
                    <td key={cell.session} className="border-b border-l border-stone-100 px-1.5 py-2 align-top">
                      {cell.people.length === 0 ? (
                        <span className="block py-1 text-center text-[11px] text-stone-300">체크한 사람 없음</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {cell.people.map((p) => {
                            const on = isAssigned(week.id, cell.session, p);
                            const elsewhere = p.memberId
                              ? (assignedIn.get(p.memberId) ?? []).filter((s) => s !== cell.session)
                              : [];
                            const clickable = !!p.memberId && !week.confirmed;
                            return (
                              <button
                                key={p.key}
                                type="button"
                                disabled={!clickable}
                                aria-pressed={on}
                                onClick={() => toggle(week, cell.session, p)}
                                title={
                                  p.guest
                                    ? "게스트 (수동 배정 화면에서 바꿔요)"
                                    : week.confirmed
                                      ? "확정된 주예요"
                                      : on
                                        ? "누르면 배정 해제"
                                        : "누르면 배정"
                                }
                                className={`flex w-full items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1 text-left text-[12.5px] transition active:scale-[0.97] disabled:cursor-default disabled:active:scale-100 ${
                                  on
                                    ? `${SESSION_TONE[cell.session]} font-extrabold shadow-sm`
                                    : "border-dashed border-stone-200 bg-white font-medium text-stone-400 hover:border-stone-300 hover:text-stone-600"
                                } ${!on && elsewhere.length ? "opacity-50" : ""}`}
                              >
                                {on && <CheckIcon size={12} strokeWidth={2.6} className="shrink-0" />}
                                <span className="whitespace-nowrap">{p.name}</span>
                                {p.guest && <span className="shrink-0 text-[10px] font-semibold text-stone-500">(G)</span>}
                                {p.satAbsent && <span className="shrink-0 text-[10px] font-semibold text-red-600">토✕</span>}
                                {!p.available && !p.guest && on && (
                                  <span className="shrink-0 text-[10px] font-semibold text-stone-500" title="이 주 이 세션에 체크하지 않았어요">
                                    미체크
                                  </span>
                                )}
                                {elsewhere.length > 0 && (
                                  <span className="ml-auto shrink-0 text-[10px] font-semibold text-stone-500">
                                    {elsewhere.map((s) => SESSION_SHORT[s]).join("·")}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
