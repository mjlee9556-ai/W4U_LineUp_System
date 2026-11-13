import type { Session } from "./sessions";

/** owner = 최종 관리자(앱 개발자), admin = 준관리자(찬양팀장·악기팀장·보컬팀장), member = 팀원 */
export type MemberRole = "member" | "admin" | "owner";
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
  /** 준관리자 직함 (찬양팀장 등). 최종 관리자가 정한다 */
  admin_title: string | null;
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

/** 관리자가 캘린더 날짜에 남긴 공지·메모 */
export type CalendarNote = { id: string; date: string; content: string; created_by: string | null; created_at: string };

/** 준관리자 직함. 최종 관리자가 팀원에게 임명한다 */
export const ADMIN_TITLES = ["찬양팀장", "악기팀장", "보컬팀장"] as const;

/** 관리 메뉴(회차·라인업 편성, 가입 승인, 초대코드, 캘린더 메모 등)를 쓸 수 있는지: 준관리자 + 최종 관리자 */
export function isAdmin(m: Pick<Member, "role">): boolean {
  return m.role === "admin" || m.role === "owner";
}

/** 팀원 계정 관리(PIN 초기화·수정, 직함 임명, 비활성화, 계정 삭제)는 최종 관리자만 */
export function isOwner(m: Pick<Member, "role">): boolean {
  return m.role === "owner";
}

/** 가입 승인 대기자 승인·거절: 최종 관리자와 찬양팀장만 */
export function canApproveSignups(m: Pick<Member, "role" | "admin_title">): boolean {
  return m.role === "owner" || (m.role === "admin" && m.admin_title === "찬양팀장");
}

/** 화면에 보일 권한 이름 */
export function roleLabel(m: Pick<Member, "role" | "admin_title">): string {
  if (m.role === "owner") return "최종 관리자";
  if (m.role === "admin") return m.admin_title || "준관리자";
  return "팀원";
}

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
 * 편성할 수 있는 응답인지. '토 불가'도 주일에는 섬길 수 있으므로 편성할 수 있다
 * (토 연습이 있는 주라면 '토 불참'으로 표시된다. missesPractice 참고)
 */
export function canServe(status: AvailabilityStatus): boolean {
  return status !== "none";
}

/** 토 연습이 있는 주에 '토 불가'로 답해 연습에 빠지는지 */
export function missesPractice(status: AvailabilityStatus, event: LineupEvent): boolean {
  return status === "sun_only" && hasSaturdayPractice(event);
}

/** SQL용 같은 규칙 (availabilities a 기준) */
export const CAN_SERVE_SQL = `a.status <> 'none'`;

/** SQL용: 토 연습이 있는 주의 '토 불가' 응답 (availabilities a 기준) */
export const MISSES_PRACTICE_SQL = `a.status = 'sun_only' and exists (
  select 1 from event_days d where d.event_id = a.event_id and d.kind = 'practice')`;

/** 토 연습이 있는 주일만 토·일을 나눠 묻고, 연습 없는 주일과 비주말 일정은 가능/불가로 받는다 */
export function hasSaturdayPractice(event: LineupEvent): boolean {
  return event.type === "weekend" && (event.event_days ?? []).some((d) => d.kind === "practice");
}

export function statusOptionsFor(event: LineupEvent) {
  return hasSaturdayPractice(event) ? WEEKEND_STATUS_OPTIONS : SPECIAL_STATUS_OPTIONS;
}
