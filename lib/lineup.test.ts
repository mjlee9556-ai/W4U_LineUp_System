import { describe, expect, it } from "vitest";
import { buildLineup, capacityWarnings, groupBySession, serviceDates } from "./lineup";
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

describe("capacityWarnings", () => {
  it("부족과 초과를 알려준다", () => {
    const w = capacityWarnings({ leader: 0, drums: 2, vocal: 5 }, [
      { session: "leader", min: 1, max: 1 },
      { session: "drums", min: 1, max: 1 },
      { session: "vocal", min: 0, max: null },
    ]);
    expect(w.map((x) => [x.session, x.kind])).toEqual([
      ["leader", "short"],
      ["drums", "over"],
    ]);
  });
});
