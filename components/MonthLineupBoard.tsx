import Link from "next/link";
import { calendarGrid, formatMonth, parseISODate, shiftMonth, WEEKDAYS } from "@/lib/dates";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export type MonthWeek = {
  id: string;
  date: string; // 대표 날짜(주일)
  practiceDates: string[];
  confirmed: boolean;
  filled: number; // 채워진 필수 세션 수
  required: number;
  people: number;
};

/**
 * 라인업 탭 위쪽의 월 캘린더: 그 달 주차별 라인업 현황을 한눈에 본다.
 * 칸을 누르면 그 주 라인업으로 이동한다.
 */
export function MonthLineupBoard({
  month,
  weeks,
  selectedId,
  showDrafts,
}: {
  month: string;
  weeks: MonthWeek[];
  selectedId?: string;
  showDrafts: boolean;
}) {
  const byDate = new Map(weeks.map((w) => [w.date, w]));
  const practice = new Set(weeks.flatMap((w) => w.practiceDates));
  const confirmedCount = weeks.filter((w) => w.confirmed).length;
  const draftCount = weeks.length - confirmedCount;
  const openSeats = weeks.filter((w) => !w.confirmed).reduce((n, w) => n + (w.required - w.filled), 0);

  return (
    <section className="panel">
      <div className="flex items-center justify-between">
        <Link href={`/lineup?month=${shiftMonth(month, -1)}`} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="이전 달">
          <ChevronLeftIcon size={19} />
        </Link>
        <h2 className="flex items-center gap-1.5 text-[16px] font-extrabold text-ink-900">
          <CalendarIcon size={17} className="text-ember-600" />
          {formatMonth(month)} 라인업 현황
        </h2>
        <Link href={`/lineup?month=${shiftMonth(month, 1)}`} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="다음 달">
          <ChevronRightIcon size={19} />
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold">
        <span className="rounded-full bg-sage-50 px-2.5 py-1 text-sage-700">확정 {confirmedCount}주</span>
        {showDrafts && <span className="rounded-full bg-gold-50 px-2.5 py-1 text-gold-700">편성 중 {draftCount}주</span>}
        {showDrafts && openSeats > 0 && <span className="rounded-full bg-ember-50 px-2.5 py-1 text-ember-600">공석 {openSeats}석</span>}
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-stone-400"}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarGrid(month).map(({ date, inMonth }) => {
          const week = inMonth ? byDate.get(date) : undefined;
          const day = parseISODate(date).getUTCDate();
          const sunday = parseISODate(date).getUTCDay() === 0;
          if (!week) {
            return (
              <div
                key={date}
                className={`flex h-14 flex-col items-center justify-start rounded-lg pt-1.5 text-[13px] font-semibold ${
                  !inMonth ? "text-stone-200" : sunday ? "text-red-400" : "text-stone-500"
                }`}
              >
                {day}
                {inMonth && practice.has(date) && <span className="mt-1 text-[9px] font-bold text-stone-400">토 연습</span>}
              </div>
            );
          }
          const full = week.filled >= week.required;
          const tone = week.confirmed
            ? "border-sage-200 bg-sage-50 text-sage-700"
            : full
              ? "border-gold-300 bg-gold-50 text-gold-700"
              : "border-ember-200 bg-ember-50 text-ember-600";
          const selected = week.id === selectedId;
          return (
            <Link
              key={date}
              href={`/lineup?event=${week.id}`}
              aria-current={selected ? "page" : undefined}
              className={`flex h-14 flex-col items-center justify-start gap-0.5 rounded-lg border pt-1 text-[13px] font-extrabold transition hover:brightness-95 ${tone} ${
                selected ? "ring-2 ring-ink-900 ring-offset-1" : ""
              }`}
            >
              {day}
              <span className="text-[10px] font-bold leading-none">{week.confirmed ? "확정" : `${week.filled}/${week.required}`}</span>
              {!week.confirmed && <span className="text-[9px] font-semibold leading-none opacity-80">{week.people}명</span>}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-stone-100 pt-2.5 text-[11px] font-semibold text-stone-500">
        <Legend tone="bg-sage-50 border-sage-200" label="라인업 확정" />
        {showDrafts && <Legend tone="bg-gold-50 border-gold-300" label="편성 중 · 전원 배정" />}
        {showDrafts && <Legend tone="bg-ember-50 border-ember-200" label="편성 중 · 공석 있음" />}
      </div>
      {weeks.length === 0 && (
        <p className="mt-2 text-center text-xs text-stone-400">{showDrafts ? "이 달에는 일정이 없어요." : "이 달에 확정된 라인업이 없어요."}</p>
      )}
    </section>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${tone}`} />
      {label}
    </span>
  );
}
