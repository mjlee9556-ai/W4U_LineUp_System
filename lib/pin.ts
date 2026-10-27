import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const PIN_PATTERN = "^[0-9]{4,6}$";

export function isValidPin(pin: string) {
  return new RegExp(PIN_PATTERN).test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** 010-1234-5678, 010 1234 5678 → 01012345678 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string) {
  return /^01[0-9]{8,9}$/.test(phone);
}

export function formatPhone(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : phone;
}
