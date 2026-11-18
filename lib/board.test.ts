import { describe, expect, it } from "vitest";
import { buildBoardCells } from "./board";
import type { Assignment, Availability, Guest, LineupEvent } from "./types";

const event: LineupEvent = {
  id: "e1", round_id: "r1", type: "weekend", title: "주일", note: null,
  start_date: "2026-12-05", end_date: "2026-12-06", lineup_status: "draft", confirmed_at: null,
  event_days: [
    { id: "d1", event_id: "e1", date: "2026-12-05", kind: "practice", start_time: null },
    { id: "d2", event_id: "e1", date: "2026-12-06", kind: "service", start_time: null },
  ],
};
const ans = (member_id: string, status: Availability["status"], sessions: Availability["sessions"]): Availability => ({
  member_id, event_id: "e1", status, sessions, comment: null, updated_at: "",
});
const names = new Map([["a", "가"], ["b", "나"], ["c", "다"], ["d", "라"]]);

describe("buildBoardCells", () => {
  it("체크한 사람은 흐리게, 배정된 사람은 진하게, 불가는 빼고, 미체크 배정·게스트도 보인다", () => {
    const answers = [ans("a", "both", ["vocal", "leader"]), ans("b", "sun_only", ["vocal"]), ans("c", "none", ["vocal"])];
    const assignments: Assignment[] = [
      { event_id: "e1", member_id: "a", session: "vocal", sat_absent: false },
      { event_id: "e1", member_id: "d", session: "vocal", sat_absent: false },
    ];
    const guests: Guest[] = [{ id: "g", event_id: "e1", session: "vocal", name: "손님" }];
    const cells = buildBoardCells(event, answers, assignments, guests, names);
    const vocal = cells.find((c) => c.session === "vocal")!.people;
    expect(vocal.map((p) => [p.name, p.assigned, p.available, p.satAbsent])).toEqual([
      ["가", true, true, false],
      ["나", false, true, true],
      ["라", true, false, false],
      ["손님", true, false, false],
    ]);
    expect(cells.find((c) => c.session === "leader")!.people.map((p) => p.name)).toEqual(["가"]);
    expect(cells.map((c) => c.session)).toEqual(["leader", "vocal", "main_keys", "second_keys", "drums", "bass", "electric"]);
  });
});
