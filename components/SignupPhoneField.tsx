"use client";

import { useState, useTransition } from "react";
import { checkPhone } from "@/app/signup/actions";
import { CheckIcon, InfoIcon } from "@/components/icons";

type Result = { ok: boolean; message: string } | null;

/** 전화번호(숫자만) + 중복확인 버튼. 가입할 때 서버에서 한 번 더 확인한다 */
export function SignupPhoneField() {
  const [value, setValue] = useState("010");
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="relative">
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="tel"
          pattern="01[0-9]{8,9}"
          title="- 없이 숫자만 입력해 주세요 (예: 01012345678)"
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value.replace(/\D/g, "").slice(0, 11));
            setResult(null);
          }}
          className="field pr-24"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await checkPhone(value)))}
          className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700 transition hover:bg-stone-200 disabled:opacity-50"
        >
          {pending ? "확인 중…" : "중복확인"}
        </button>
      </div>
      {result ? (
        <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${result.ok ? "text-emerald-700" : "text-accent-600"}`} aria-live="polite">
          {result.ok ? <CheckIcon size={14} /> : <InfoIcon size={14} />}
          {result.message}
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-stone-500">
          <InfoIcon size={14} />
          가입 후 예배 출석 및 사역 포털 로그인 ID로 사용됩니다.
        </p>
      )}
    </div>
  );
}
