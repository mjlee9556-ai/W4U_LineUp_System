// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룬다. 시간대 영향을 받지 않도록 UTC 기준으로 계산한다.

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** 'YYYY-MM' → 'YYYY-MM-01' */
export function monthStart(month: string): string {
  return `${month}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toISODate(d).slice(0, 7);
}

export function isValidMonth(month: string | undefined): month is string {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** 오늘(한국 시간)의 'YYYY-MM-DD' */
export function todayKST(): string {
  return toISODate(new Date(Date.now() + 9 * 60 * 60 * 1000));
}

export type WeekendSet = { saturday: string; sunday: string };

/**
 * 한 달의 주말 세트 목록. 세트는 그 달에 속한 일요일 기준이며,
 * 토요일 연습은 전날이라 1일이 일요일이면 지난달 말일이 될 수 있다.
 */
export function weekendSets(month: string): WeekendSet[] {
  const first = parseISODate(monthStart(month));
  const offset = (7 - first.getUTCDay()) % 7; // 첫 일요일까지
  const sets: WeekendSet[] = [];
  let sunday = addDays(monthStart(month), offset);
  while (sunday.startsWith(month)) {
    sets.push({ saturday: addDays(sunday, -1), sunday });
    sunday = addDays(sunday, 7);
  }
  return sets;
}

/** 월 캘린더 격자. 일요일 시작, 앞뒤를 이웃 달 날짜로 채운 7의 배수 길이 */
export function calendarGrid(month: string): { date: string; inMonth: boolean }[] {
  const start = monthStart(month);
  const first = parseISODate(start);
  const gridStart = addDays(start, -first.getUTCDay());
  const nextMonth = monthStart(shiftMonth(month, 1));
  const lastDay = addDays(nextMonth, -1);
  const gridEnd = addDays(lastDay, 6 - parseISODate(lastDay).getUTCDay());

  const cells: { date: string; inMonth: boolean }[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    cells.push({ date: d, inMonth: d.startsWith(month) });
  }
  return cells;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabel(s: string): string {
  return WEEKDAYS[parseISODate(s).getUTCDay()];
}

/** '2026-12-06' → '12/6(일)' */
export function formatShort(s: string): string {
  const d = parseISODate(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${weekdayLabel(s)})`;
}

/** '2026-12' → '2026년 12월' */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export { WEEKDAYS };
