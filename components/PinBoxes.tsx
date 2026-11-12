"use client";

import { useState } from "react";
// lib/pin은 crypto를 써서 클라이언트에 넣지 않는다 (PIN_PATTERN과 같은 규칙)
const PIN_PATTERN = "^[0-9]{4,6}$";

/** PIN 입력: 칸 6개로 보이지만 실제로는 숫자 입력 하나. 5·6번째 칸은 6자리 PIN일 때만 쓴다 */
export function PinBoxes({ id = "pin", name = "pin", autoComplete = "current-password" }: { id?: string; name?: string; autoComplete?: string }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < value.length;
          const active = focused && i === Math.min(value.length, 5);
          const optional = i >= 4;
          return (
            <div
              key={i}
              className={`flex h-12 items-center justify-center rounded-xl border transition ${
                active
                  ? "border-2 border-navy-900 bg-white"
                  : filled
                    ? "border-stone-300 bg-white"
                    : optional
                      ? "border-dashed border-stone-300 bg-transparent"
                      : "border-stone-200 bg-stone-100/80"
              }`}
            >
              {filled ? <span className="h-3 w-3 rounded-full bg-navy-900" /> : active && <span className="h-2 w-2 rounded-full bg-stone-300" />}
            </div>
          );
        })}
      </div>
      <input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        required
        pattern={PIN_PATTERN}
        autoComplete={autoComplete}
        maxLength={6}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        aria-label="PIN 숫자 4~6자리"
      />
    </div>
  );
}
