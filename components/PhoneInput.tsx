"use client";

/** 전화번호는 숫자만: 하이픈·공백을 입력하거나 붙여 넣으면 바로 지운다 */
export function PhoneInput({ id = "phone", name = "phone" }: { id?: string; name?: string }) {
  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      required
      autoComplete="tel"
      pattern="01[0-9]{8,9}"
      title="- 없이 숫자만 입력해 주세요 (예: 01012345678)"
      placeholder="01012345678 (- 없이 숫자만)"
      onInput={(e) => {
        const el = e.currentTarget;
        const digits = el.value.replace(/\D/g, "").slice(0, 11);
        if (digits !== el.value) el.value = digits;
      }}
      className="input"
    />
  );
}
