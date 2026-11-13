"use client";

import { useState } from "react";
import {
  AUTO_ASSIGN_DEFAULT_COUNT,
  AUTO_ASSIGN_SESSIONS,
  INSTRUMENT_SESSIONS,
  SESSION_LABELS,
  VOICE_SESSIONS,
  type Session,
} from "@/lib/sessions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CheckIcon, SparklesIcon } from "@/components/icons";

/**
 * 자동 배정 범위(보컬 / 악기 / 모두) 체크박스와 파트별 한 주 인원 칸.
 * 고르지 않은 묶음의 칸은 흐리게 두고, 서버에서도 그 파트 배정은 건드리지 않는다.
 */
export function AutoAssignOptions({ draftCount }: { draftCount: number }) {
  const [vocal, setVocal] = useState(true);
  const [instrument, setInstrument] = useState(true);
  const all = vocal && instrument;
  const none = !vocal && !instrument;

  const on = (s: Session) => (VOICE_SESSIONS.includes(s) ? vocal : INSTRUMENT_SESSIONS.includes(s) ? instrument : false);
  const scopeLabel = all ? "보컬·악기" : vocal ? "보컬" : "악기";

  return (
    <>
      <div>
        <div className="mb-2.5 text-sm font-bold text-ink-900">자동 배정 범위</div>
        <div className="grid grid-cols-3 gap-2">
          <ScopeBox label="보컬 자동배정" sub="보컬 파트" checked={vocal} onChange={setVocal} name="scope" value="vocal" />
          <ScopeBox label="악기 자동배정" sub="건반·기타·베이스·드럼" checked={instrument} onChange={setInstrument} name="scope" value="instrument" />
          <ScopeBox
            label="모두 자동배정"
            sub="보컬 + 악기"
            checked={all}
            onChange={(v) => {
              setVocal(v);
              setInstrument(v);
            }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          인도자·서브 인도자는 자동 배정하지 않아요. 편성 화면에서 직접 정해 주세요. 고르지 않은 파트도 지금 배정을 그대로 두고, 공평 분배
          횟수 계산에만 넣어요.
        </p>
      </div>

      <div>
        <div className="mb-2.5 text-sm font-bold text-ink-900">파트별 한 주 목표 인원 설정</div>
        <div className="grid grid-cols-4 gap-2">
          {AUTO_ASSIGN_SESSIONS.map((s) => (
            <label
              key={s}
              className={`rounded-xl border border-stone-200 bg-stone-50 p-2 text-center transition ${on(s) ? "" : "opacity-40"}`}
            >
              <span className="block truncate text-[11px] font-bold text-stone-500">{SESSION_LABELS[s]}</span>
              <input
                name={`count:${s}`}
                type="number"
                min={0}
                max={5}
                defaultValue={AUTO_ASSIGN_DEFAULT_COUNT[s] ?? 1}
                disabled={!on(s)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white py-1 text-center text-[18px] font-bold text-ink-900 focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">0으로 두면 그 파트는 비워 둬요. 직접 넣거나 게스트로 채울 수 있어요.</p>
      </div>

      {draftCount ? (
        none ? (
          <p className="rounded-lg bg-ember-50 px-3 py-2.5 text-center text-sm font-semibold text-ember-600">
            자동 배정할 범위를 하나 이상 골라 주세요.
          </p>
        ) : (
          <ConfirmSubmitButton
            confirmMessage={`편성 중인 ${draftCount}주의 ${scopeLabel} 배정을 자동으로 새로 채울까요?\n\n그 파트는 직접 고친 배정도 다시 정해져요. 인도자, ${
              all ? "" : "고르지 않은 파트, "
            }확정된 주와 게스트는 그대로예요.`}
            pendingText="배정 중…"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-sm font-bold text-white shadow-sm transition hover:bg-navy-800 disabled:opacity-60"
          >
            <SparklesIcon size={18} />
            {all ? "스마트 자동 배정 실행하기" : `${vocal ? "보컬" : "악기"} 자동 배정 실행하기`}
          </ConfirmSubmitButton>
        )
      ) : (
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500">편성 중인 주가 없어요. 바꾸려면 그 주의 확정을 먼저 풀어 주세요.</p>
      )}
    </>
  );
}

function ScopeBox({
  label,
  sub,
  checked,
  onChange,
  name,
  value,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  name?: string;
  value?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-900/30 ${
        checked ? "border-ink-900 bg-ink-50" : "border-stone-200 bg-white hover:bg-stone-50"
      }`}
    >
      <input type="checkbox" name={name} value={value} checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="flex items-center gap-1.5">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            checked ? "border-ink-900 bg-ink-900 text-white" : "border-stone-300 bg-white"
          }`}
        >
          {checked && <CheckIcon size={11} strokeWidth={3} />}
        </span>
        <span className="text-[12.5px] font-bold leading-tight text-ink-900">{label}</span>
      </span>
      <span className="text-[10.5px] leading-tight text-stone-500">{sub}</span>
    </label>
  );
}
