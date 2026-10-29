import type { Session } from "./sessions";

export type MemberRole = "member" | "admin";
export type MemberStatus = "pending" | "approved" | "inactive";
export type EventType = "weekend" | "retreat" | "special";
export type LineupStatus = "draft" | "confirmed";
export type AvailabilityStatus = "both" | "sun_only" | "available" | "none";

export type Member = {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string;
  email: string | null;
  district: string | null; // 거주지 (예: 수원시 장안구 조원동). 예전 가입자는 구만 들어 있다
  dong: string | null;
  role: MemberRole;
  status: MemberStatus;
  created_at: string;
};

export type Round = {
  id: string;
  target_month: string;
  opens_at: string;
  closes_at: string | null;
  status: "open" | "closed";
};

export type EventDay = {
  id: string;
  event_id: string;
  date: string;
  kind: "practice" | "service";
  start_time: string | null;
};

export type LineupEvent = {
  id: string;
  round_id: string | null;
  type: EventType;
  title: string;
  note: string | null;
  start_date: string;
  end_date: string;
  lineup_status: LineupStatus;
  confirmed_at: string | null;
  event_days?: EventDay[];
};

export type Availability = {
  member_id: string;
  event_id: string;
  status: AvailabilityStatus;
  sessions: Session[];
  comment: string | null;
  updated_at: string;
};

export type Assignment = {
  event_id: string;
  member_id: string;
  session: Session;
  sat_absent: boolean;
};

export type Guest = { id: string; event_id: string; session: Session; name: string };

/** 거주지 표시용. 예전 가입자는 구·동이 나뉘어 저장돼 있다 */
export function formatAddress(m: Pick<Member, "district" | "dong">): string {
  return [m.district, m.dong].filter(Boolean).join(" ");
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  weekend: "주일",
  retreat: "수련회",
  special: "특별예배",
};

export const WEEKEND_STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "both", label: "토·일 가능" },
  { value: "sun_only", label: "토 불가" },
  { value: "none", label: "불가" },
];

export const SPECIAL_STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "가능" },
  { value: "none", label: "불가" },
];

/**
 * 편성할 수 있는 응답인지. '토 불가'는 토 연습이 있는 주에는 편성하지 않는다
 * (연습 없는 주로 바꾸면 '토 불가' 응답은 '가능'으로 바뀐다)
 */
export function canServe(status: AvailabilityStatus, event: LineupEvent): boolean {
  if (status === "none") return false;
  if (status === "sun_only") return !hasSaturdayPractice(event);
  return true;
}

/** SQL용 같은 규칙 (availabilities a 기준) */
export const CAN_SERVE_SQL = `a.status <> 'none' and not (a.status = 'sun_only' and exists (
  select 1 from event_days d where d.event_id = a.event_id and d.kind = 'practice'))`;

/** 토 연습이 있는 주일만 토·일을 나눠 묻고, 연습 없는 주일과 비주말 일정은 가능/불가로 받는다 */
export function hasSaturdayPractice(event: LineupEvent): boolean {
  return event.type === "weekend" && (event.event_days ?? []).some((d) => d.kind === "practice");
}

export function statusOptionsFor(event: LineupEvent) {
  return hasSaturdayPractice(event) ? WEEKEND_STATUS_OPTIONS : SPECIAL_STATUS_OPTIONS;
}
