export const SESSIONS = [
  "leader",
  "sub_leader",
  "vocal",
  "main_keys",
  "second_keys",
  "bass",
  "electric",
  "acoustic",
  "drums",
] as const;

export type Session = (typeof SESSIONS)[number];

export const SESSION_LABELS: Record<Session, string> = {
  leader: "인도자",
  sub_leader: "서브 인도자",
  vocal: "보컬",
  main_keys: "메인 건반",
  second_keys: "세컨 건반",
  bass: "베이스",
  electric: "일렉",
  acoustic: "어쿠스틱",
  drums: "드럼",
};

/** 캘린더 칸처럼 좁은 곳에 쓰는 짧은 이름 */
export const SESSION_SHORT: Record<Session, string> = {
  leader: "인도",
  sub_leader: "서브",
  vocal: "보컬",
  main_keys: "메인",
  second_keys: "세컨",
  bass: "베이스",
  electric: "일렉",
  acoustic: "어쿠",
  drums: "드럼",
};

/** 가입 때 고를 수 있는 세션. 서브 인도자는 관리자가 배정할 때만 사용 */
export const SIGNUP_SESSIONS = SESSIONS.filter((s) => s !== "sub_leader");

export function isSession(value: string): value is Session {
  return (SESSIONS as readonly string[]).includes(value);
}

export function sortBySession<T extends { session: Session }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => SESSIONS.indexOf(a.session) - SESSIONS.indexOf(b.session));
}

/** 라인업 화면에서 묶어 보여 주는 파트 */
export const SESSION_GROUPS: { key: string; label: string; sessions: Session[] }[] = [
  { key: "lead", label: "예배 인도", sessions: ["leader", "sub_leader"] },
  { key: "vocal", label: "보컬 / 싱어", sessions: ["vocal"] },
  { key: "keys", label: "건반 / Keyboard", sessions: ["main_keys", "second_keys"] },
  { key: "guitar", label: "기타 / Guitar", sessions: ["acoustic", "electric"] },
  { key: "rhythm", label: "리듬 / Rhythm", sessions: ["bass", "drums"] },
];

/** 매주 채워야 하는 세션 (서브 인도자는 있으면 좋은 자리라 빼고 센다) */
export const REQUIRED_SESSIONS: readonly Session[] = SIGNUP_SESSIONS;
