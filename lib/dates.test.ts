import { describe, expect, it } from "vitest";
import { calendarGrid, formatShort, isCommunionSunday, shiftMonth, weekendSets } from "./dates";

describe("weekendSets", () => {
  it("2026년 12월은 일요일 4번", () => {
    expect(weekendSets("2026-12")).toEqual([
      { saturday: "2026-12-05", sunday: "2026-12-06" },
      { saturday: "2026-12-12", sunday: "2026-12-13" },
      { saturday: "2026-12-19", sunday: "2026-12-20" },
      { saturday: "2026-12-26", sunday: "2026-12-27" },
    ]);
  });

  it("1일이 일요일이면 토 연습은 지난달 말일", () => {
    // 2026-11-01은 일요일
    const sets = weekendSets("2026-11");
    expect(sets[0]).toEqual({ saturday: "2026-10-31", sunday: "2026-11-01" });
    expect(sets).toHaveLength(5);
  });
});

describe("calendarGrid", () => {
  it("일요일에 시작해 토요일에 끝나는 7의 배수 칸", () => {
    const grid = calendarGrid("2026-12");
    expect(grid.length % 7).toBe(0);
    expect(grid[0].date).toBe("2026-11-29");
    expect(grid.at(-1)!.date).toBe("2027-01-02");
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });
});

describe("helpers", () => {
  it("shiftMonth는 연도를 넘긴다", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });
  it("formatShort", () => {
    expect(formatShort("2026-12-06")).toBe("12/6(일)");
  });
});

describe("isCommunionSunday", () => {
  it("매월 첫째 일요일만", () => {
    expect(isCommunionSunday("2026-11-01")).toBe(true);
    expect(isCommunionSunday("2026-11-08")).toBe(false);
    expect(isCommunionSunday("2026-12-06")).toBe(true);
    expect(isCommunionSunday("2026-12-05")).toBe(false); // 토요일
  });
});
