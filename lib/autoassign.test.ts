import { describe, expect, it } from "vitest";
import { autoAssign } from "./autoassign";
import type { Session } from "./sessions";

const weeks = [1, 2, 3, 4, 5].map((n) => ({ id: `w${n}` }));

function avail(table: Partial<Record<Session, Record<string, number[]>>>) {
  return (eventId: string, session: Session) =>
    Object.entries(table[session] ?? {})
      .filter(([, ws]) => ws.includes(Number(eventId.slice(1))))
      .map(([name]) => name);
}

const weeksOf = (rows: { eventId: string; memberId: string }[], who: string) =>
  rows.filter((r) => r.memberId === who).map((r) => Number(r.eventId.slice(1))).sort();

describe("autoAssign", () => {
  it("요청 예시: 베이스 A(1,2,4,5) B(3,5) → A 1·2·4, B 3·5", () => {
    const rows = autoAssign({
      events: weeks,
      sessions: [{ session: "bass", count: 1 }],
      candidates: avail({ bass: { A: [1, 2, 4, 5], B: [3, 5] } }),
    });
    expect(weeksOf(rows, "A")).toEqual([1, 2, 4]);
    expect(weeksOf(rows, "B")).toEqual([3, 5]);
  });

  it("모두 가능하면 횟수를 고르게 나눈다", () => {
    const rows = autoAssign({
      events: weeks,
      sessions: [{ session: "drums", count: 1 }],
      candidates: avail({ drums: { A: [1, 2, 3, 4, 5], B: [1, 2, 3, 4, 5], C: [1, 2, 3, 4, 5] } }),
    });
    const counts = ["A", "B", "C"].map((p) => weeksOf(rows, p).length).sort();
    expect(counts).toEqual([1, 2, 2]);
  });

  it("가능한 사람이 없는 주는 비워 둔다", () => {
    const rows = autoAssign({
      events: weeks,
      sessions: [{ session: "bass", count: 1 }],
      candidates: avail({ bass: { A: [1, 2] } }),
    });
    expect(rows.map((r) => r.eventId)).toEqual(["w1", "w2"]);
  });

  it("인원 수만큼 서로 다른 사람을 넣는다", () => {
    const rows = autoAssign({
      events: [{ id: "w1" }],
      sessions: [{ session: "electric", count: 2 }],
      candidates: avail({ electric: { A: [1], B: [1], C: [1] } }),
    });
    expect(new Set(rows.map((r) => r.memberId)).size).toBe(2);
  });

  it("같은 주에 한 사람을 두 세션에 넣지 않는다", () => {
    const rows = autoAssign({
      events: [{ id: "w1" }],
      sessions: [
        { session: "leader", count: 1 },
        { session: "electric", count: 1 },
      ],
      candidates: avail({ leader: { A: [1] }, electric: { A: [1], B: [1] } }),
    });
    expect(rows).toEqual([
      { eventId: "w1", memberId: "A", session: "leader" },
      { eventId: "w1", memberId: "B", session: "electric" },
    ]);
    const onlyA = autoAssign({
      events: [{ id: "w1" }],
      sessions: [
        { session: "bass", count: 1 },
        { session: "drums", count: 1 },
      ],
      candidates: avail({ bass: { A: [1] }, drums: { A: [1] } }),
    });
    expect(onlyA).toEqual([{ eventId: "w1", memberId: "A", session: "bass" }]);
  });

  it("확정된 주의 배정도 횟수에 넣는다", () => {
    const rows = autoAssign({
      events: [{ id: "w2" }],
      sessions: [{ session: "bass", count: 1 }],
      candidates: avail({ bass: { A: [1, 2], B: [2] } }),
      fixed: [{ eventId: "w1", memberId: "B", session: "bass" }],
    });
    // B가 이미 1번 섬겼으니 A
    expect(rows[0].memberId).toBe("A");
  });
});
