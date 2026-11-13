import { formatKSTDateTime } from "@/lib/dates";
import { PART_LABELS, partOf, type Part, type Session } from "@/lib/sessions";
import type { PartSave } from "@/lib/week";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";

/**
 * 파트별 저장 현황: 보컬팀장·악기팀장이 따로 저장한 배정이 한 주 라인업에 어떻게 합쳐졌는지 보여 준다.
 * filled: 그 파트에 들어간 세션들 (배정·게스트 포함)
 */
export function PartSaveStatus({
  saves,
  filledSessions,
  parts = ["lead", "vocal", "instrument"],
}: {
  saves: PartSave[];
  filledSessions: Session[];
  parts?: Part[];
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {parts.map((part) => {
        const save = saves.find((x) => x.part === part);
        const count = filledSessions.filter((s) => partOf(s) === part).length;
        return (
          <li
            key={part}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
              save ? "border-sage-200 bg-sage-50/60" : "border-dashed border-stone-300 bg-white"
            }`}
          >
            {save ? (
              <CheckCircleIcon size={16} className="mt-0.5 shrink-0 text-sage-700" />
            ) : (
              <ClockIcon size={16} className="mt-0.5 shrink-0 text-stone-400" />
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold text-ink-900">
                {PART_LABELS[part]} <span className="text-xs font-semibold text-stone-500">· {count}개 세션</span>
              </div>
              <div className="truncate text-[11px] text-stone-500">
                {save
                  ? `${save.saved_by_name ?? "(탈퇴)"} · ${formatKSTDateTime(save.saved_at)} ${save.method === "auto" ? "자동" : "수동"} 저장`
                  : "아직 저장 안 함"}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
