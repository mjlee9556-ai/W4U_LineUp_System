import { describe, expect, it } from "vitest";
import { hashPin, isValidPhone, isValidPin, normalizePhone, verifyPin } from "./pin";

describe("PIN", () => {
  it("해시한 PIN만 맞다고 한다", () => {
    const stored = hashPin("1234");
    expect(stored).not.toContain("1234:");
    expect(verifyPin("1234", stored)).toBe(true);
    expect(verifyPin("4321", stored)).toBe(false);
  });
  it("4~6자리 숫자만", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345a")).toBe(false);
  });
});

describe("전화번호", () => {
  it("숫자만 남긴다", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(isValidPhone("01012345678")).toBe(true);
    expect(isValidPhone("0212345678")).toBe(false);
  });
});
