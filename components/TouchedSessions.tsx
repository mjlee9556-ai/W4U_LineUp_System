"use client";

import { useEffect, useRef, useState } from "react";
import { PART_LABELS, partOf, SESSION_LABELS, isSession, type Session } from "@/lib/sessions";

/**
 * 라인업 편성 폼 안에 두면, 사용자가 실제로 고친 세션만 'touched'로 함께 보낸다.
 * 서버는 그 세션만 바꾸므로, 다른 팀장이 그사이 저장한 파트를 덮어쓰지 않는다.
 * 각 세션 칸은 data-session 속성으로 표시돼 있어야 한다.
 */
export function TouchedSessions() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [touched, setTouched] = useState<Session[]>([]);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const mark = (e: Event) => {
      const box = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-session]");
      const session = box?.dataset.session;
      if (!session || !isSession(session)) return;
      setTouched((prev) => (prev.includes(session) ? prev : [...prev, session]));
    };
    form.addEventListener("change", mark);
    form.addEventListener("input", mark);
    return () => {
      form.removeEventListener("change", mark);
      form.removeEventListener("input", mark);
    };
  }, []);

  const parts = [...new Set(touched.map(partOf))];
  return (
    <span ref={anchor} className="block">
      <input type="hidden" name="partial" value="1" />
      {touched.map((s) => (
        <input key={s} type="hidden" name="touched" value={s} />
      ))}
      <span className="block text-center text-xs text-stone-500" aria-live="polite">
        {touched.length === 0 ? (
          "고친 세션이 없어요. 고친 세션만 저장돼서 다른 팀장의 배정은 그대로 남아요."
        ) : (
          <>
            저장할 변경: <b className="text-ink-900">{parts.map((p) => PART_LABELS[p]).join("·")}</b> (
            {touched.map((s) => SESSION_LABELS[s]).join(", ")}) · 다른 파트는 그대로 남아요
          </>
        )}
      </span>
    </span>
  );
}
