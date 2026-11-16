"use client";

import { useEffect, useMemo, useState } from "react";
import { importChart, isChordLine, keyName, parseKey, transposeChart, transposeKey } from "@/lib/chords";
import { SubmitButton } from "@/components/SubmitButton";

const storageKey = (songId: string) => `transpose:${songId}`;

/** 코드 악보 보기: 반음씩 올리고 내려(이조) 볼 수 있다. 바꾼 키는 이 기기에만 기억하고, 편집할 수 있는 사람은 곡의 키로 저장할 수 있다 */
export function ChordChart({
  songId,
  chart,
  songKey,
  saveAction,
}: {
  songId: string;
  chart: string;
  songKey: string | null;
  /** 콘티를 고칠 수 있는 사람에게만 준다 */
  saveAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [steps, setSteps] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey(songId)));
      if (Number.isInteger(saved) && saved !== 0) setSteps(saved);
    } catch {
      // 저장소를 못 쓰는 브라우저: 원래 키로 보여 준다
    }
  }, [songId]);

  function change(next: number) {
    const normalized = ((((next + 5) % 12) + 12) % 12) - 5; // -5 ~ +6 반음
    setSteps(normalized);
    try {
      if (normalized) localStorage.setItem(storageKey(songId), String(normalized));
      else localStorage.removeItem(storageKey(songId));
    } catch {}
  }

  const baseKey = useMemo(() => parseKey(songKey) ?? parseKey(importChart(chart).key), [songKey, chart]);
  const target = baseKey ? transposeKey(baseKey, steps) : null;
  const shown = useMemo(() => transposeChart(chart, steps, { targetKey: target }), [chart, steps, target]);
  const lines = shown.split("\n");

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-stone-700" aria-expanded={open}>
          코드 악보 {open ? "▾" : "▸"}
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => change(steps - 1)} className="btn-secondary h-8 w-8 p-0 text-sm" aria-label="반음 내리기">
            −
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-bold text-stone-800" aria-live="polite">
            {target ? `${keyName(target)} Key` : "원래 키"}
            {steps !== 0 && <span className="block text-[10px] font-normal text-stone-500">{steps > 0 ? `+${steps}` : steps} 반음</span>}
          </span>
          <button type="button" onClick={() => change(steps + 1)} className="btn-secondary h-8 w-8 p-0 text-sm" aria-label="반음 올리기">
            +
          </button>
          {steps !== 0 && (
            <button type="button" onClick={() => change(0)} className="px-1 text-xs text-stone-500 hover:underline">
              원키{baseKey ? `(${keyName(baseKey)})` : ""}
            </button>
          )}
        </div>
      </div>
      {open && (
        <>
          <pre className="overflow-x-auto px-3 py-2 font-mono text-[13px] leading-5 text-stone-800">
            {lines.map((line, i) => (
              <div key={i} className={isChordLine(line) ? "font-bold text-accent-600" : undefined}>
                {line || " "}
              </div>
            ))}
          </pre>
          {saveAction && steps !== 0 && (
            <form action={saveAction} className="flex items-center gap-2 border-t border-stone-200 px-3 py-2">
              <input type="hidden" name="song_id" value={songId} />
              <input type="hidden" name="steps" value={steps} />
              <p className="flex-1 text-xs text-stone-500">팀원 모두 이 키로 보게 하려면 저장하세요.</p>
              <SubmitButton
                className="btn-primary px-3 py-1.5 text-xs"
                pendingText="저장 중…"
                onClick={() => {
                  try {
                    localStorage.removeItem(storageKey(songId));
                  } catch {}
                }}
              >
                {target ? `${keyName(target)} Key로 저장` : "이 키로 저장"}
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </div>
  );
}
