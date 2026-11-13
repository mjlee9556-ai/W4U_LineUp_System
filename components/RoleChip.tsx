import { SESSION_LABELS, SESSION_SHORT, type Session } from "@/lib/sessions";

/**
 * 파트 색 (라인업 관리 디자인)
 * 노래: 테라코타 / 건반: 남색 / 기타: 세이지 / 리듬: 엄버
 */
export const SESSION_TONE: Record<Session, string> = {
  leader: "border-ember-200 bg-ember-50 text-ember-600",
  sub_leader: "border-ember-200 bg-ember-50 text-ember-600",
  vocal: "border-ember-200 bg-ember-50 text-ember-600",
  main_keys: "border-ink-200 bg-ink-50 text-ink-900",
  second_keys: "border-ink-200 bg-ink-50 text-ink-900",
  electric: "border-sage-200 bg-sage-50 text-sage-700",
  acoustic: "border-sage-200 bg-sage-50 text-sage-700",
  bass: "border-umber-200 bg-umber-50 text-umber-700",
  drums: "border-umber-200 bg-umber-50 text-umber-700",
};

/** 파트 이름표. children을 주면 파트 이름 뒤에 굵게 붙인다 (예: "베이스 이명준") */
export function RoleChip({
  session,
  short = false,
  children,
  className = "",
}: {
  session: Session;
  short?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${SESSION_TONE[session]} ${className}`}
    >
      {short ? SESSION_SHORT[session] : SESSION_LABELS[session]}
      {children && <span className="text-[13px] font-bold text-stone-900">{children}</span>}
    </span>
  );
}
