import { describe, expect, it } from "vitest";
import { buildLineup, groupBySession, parseGuestNames, serviceDates } from "./lineup";
import type { LineupEvent } from "./types";

describe("buildLineup / groupBySession", () => {
  it("세션 순서대로 정렬하고 묶는다", () => {
    const names = new Map([["a", "가"], ["b", "나"], ["c", "다"]]);
    const entries = buildLineup(
      [
        { event_id: "e", member_id: "a", session: "drums", sat_absent: false },
        { event_id: "e", member_id: "b", session: "vocal", sat_absent: true },
        { event_id: "e", member_id: "c", session: "leader", sat_absent: false },
        { event_id: "e", member_id: "a", session: "vocal", sat_absent: false },
      ],
      names,
    );
    expect(entries.map((e) => e.session)).toEqual(["leader", "vocal", "vocal", "drums"]);
    expect(groupBySession(entries).map((g) => [g.session, g.entries.length])).toEqual([
      ["leader", 1],
      ["vocal", 2],
      ["drums", 1],
    ]);
  });
});

describe("serviceDates", () => {
  it("예배일이 없으면 시작일", () => {
    const event = { start_date: "2026-12-24", event_days: [] } as unknown as LineupEvent;
    expect(serviceDates(event)).toEqual(["2026-12-24"]);
  });
});

describe("게스트", () => {
  it("같은 세션 안에서 팀원 뒤에 붙는다", () => {
    const entries = buildLineup(
      [{ event_id: "e", member_id: "a", session: "electric", sat_absent: false }],
      new Map([["a", "가"]]),
      [
        { id: "g1", event_id: "e", session: "electric", name: "손님" },
        { id: "g2", event_id: "e", session: "leader", name: "외부 인도자" },
      ],
    );
    expect(entries.map((e) => [e.session, e.name, e.guest])).toEqual([
      ["leader", "외부 인도자", true],
      ["electric", "가", false],
      ["electric", "손님", true],
    ]);
  });

  it("이름 입력을 쉼표로 나누고 정리한다", () => {
    expect(parseGuestNames(" 홍길동 ,김  철수,, 홍길동 ")).toEqual(["홍길동", "김 철수"]);
    expect(parseGuestNames("")).toEqual([]);
  });
});
