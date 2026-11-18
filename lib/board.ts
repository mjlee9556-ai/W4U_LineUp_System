import type { Session } from "@/lib/sessions";
import { canServe, missesPractice, type Assignment, type Availability, type Guest, type LineupEvent } from "@/lib/types";

/** 월간 배정표의 열: 인도자 / 보컬 / 1st 건반 / 2nd 건반 / 드럼 / 베이스 / 일렉 */
export const BOARD_COLUMNS: { session: Session; label: string }[] = [
  { session: "leader", label: "인도자" },
  { session: "vocal", label: "보컬" },
  { session: "main_keys", label: "1st 건반" },
  { session: "second_keys", label: "2nd 건반" },
  { session: "drums", label: "드럼" },
  { session: "bass", label: "베이스" },
  { session: "electric", label: "일렉" },
];

/** 표 한 칸에 보이는 이름 하나 */
export type BoardPerson = {
  /** 팀원이면 member id, 게스트면 guest:<id> */
  key: string;
  memberId: string | null;
  name: string;
  assigned: boolean;
  /** 이 주 이 세션에 가능하다고 체크했는지 */
  available: boolean;
  /** 토 연습이 있는 주에 '토 불가'로 답했는지 */
  satAbsent: boolean;
  guest: boolean;
};

export type BoardCell = { session: Session; people: BoardPerson[] };

/**
 * 한 주의 칸들을 만든다. 칸에는 그 세션에 체크한 사람(흐리게)과 이미 배정된 사람(진하게)이 함께 보인다.
 * 체크하지 않았는데 배정된 사람(수동 배정)과 게스트도 배정된 사람으로 보인다.
 */
export function buildBoardCells(
  event: LineupEvent,
  answers: Availability[],
  assignments: Assignment[],
  guests: Guest[],
  names: Map<string, string>,
): BoardCell[] {
  const mine = answers.filter((a) => a.event_id === event.id && canServe(a.status));
  const assigned = assignments.filter((a) => a.event_id === event.id);
  return BOARD_COLUMNS.map(({ session }) => {
    const people = new Map<string, BoardPerson>();
    for (const a of mine) {
      if (!a.sessions.includes(session)) continue;
      people.set(a.member_id, {
        key: a.member_id,
        memberId: a.member_id,
        name: names.get(a.member_id) ?? "(탈퇴)",
        assigned: false,
        available: true,
        satAbsent: missesPractice(a.status, event),
        guest: false,
      });
    }
    for (const a of assigned) {
      if (a.session !== session) continue;
      const known = people.get(a.member_id);
      people.set(a.member_id, {
        key: a.member_id,
        memberId: a.member_id,
        name: names.get(a.member_id) ?? "(탈퇴)",
        available: known?.available ?? false,
        satAbsent: a.sat_absent,
        assigned: true,
        guest: false,
      });
    }
    const list = [...people.values()].sort((x, y) => x.name.localeCompare(y.name, "ko"));
    for (const g of guests) {
      if (g.event_id !== event.id || g.session !== session) continue;
      list.push({ key: `guest:${g.id}`, memberId: null, name: g.name, assigned: true, available: false, satAbsent: false, guest: true });
    }
    return { session, people: list };
  });
}
