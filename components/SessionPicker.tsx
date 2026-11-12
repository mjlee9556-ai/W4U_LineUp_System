"use client";

import { useState } from "react";
import { SESSION_LABELS, type Session } from "@/lib/sessions";
import {
  CheckIcon,
  DrumIcon,
  GuitarIcon,
  MicIcon,
  MicStandIcon,
  NoteIcon,
  PianoIcon,
  WaveIcon,
  ZapIcon,
} from "@/components/icons";

const ICONS: Partial<Record<Session, (p: { size?: number }) => React.ReactNode>> = {
  leader: MicStandIcon,
  vocal: MicIcon,
  main_keys: PianoIcon,
  second_keys: NoteIcon,
  bass: WaveIcon,
  electric: ZapIcon,
  acoustic: GuitarIcon,
  drums: DrumIcon,
};

/** 노래하는 파트는 주황, 나머지는 남색으로 선택 표시 */
const VOICE: Session[] = ["leader", "vocal"];

export function SessionPicker({ sessions, defaultValue = [] }: { sessions: readonly Session[]; defaultValue?: Session[] }) {
  const [picked, setPicked] = useState<Set<Session>>(new Set(defaultValue));

  const toggle = (s: Session) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <>
      <span
        className={`absolute right-4 top-4 rounded-md px-2 py-0.5 text-xs font-semibold ${
          picked.size ? "bg-navy-50 text-navy-900" : "bg-stone-100 text-stone-500"
        }`}
        aria-live="polite"
      >
        {picked.size}개 선택됨
      </span>
      <div className="flex flex-wrap gap-2">
        {sessions.map((s) => {
          const on = picked.has(s);
          const Icon = ICONS[s];
          const tone = on
            ? VOICE.includes(s)
              ? "border-accent-300 bg-accent-50 text-accent-600"
              : "border-navy-900 bg-navy-900 text-white"
            : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300";
          return (
            <label key={s} className="cursor-pointer">
              <input
                type="checkbox"
                name="sessions"
                value={s}
                checked={on}
                onChange={() => toggle(s)}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 select-none items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition peer-focus-visible:ring-2 peer-focus-visible:ring-navy-900/30 ${tone}`}
              >
                {Icon && <Icon size={16} />}
                {SESSION_LABELS[s]}
                {on && <CheckIcon size={15} strokeWidth={2.4} />}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}
