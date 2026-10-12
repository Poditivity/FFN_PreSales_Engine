export const OTP_LENGTH = 6;

/** Keeps digits only and caps the length, so a pasted "123 456" or "123-456" still works. */
export function sanitizeDigits(raw: string, max = OTP_LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

export function isCompleteCode(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

/** Seconds left on a resend cooldown, never below zero. */
export function secondsLeft(readyAt: number, now: number): number {
  return Math.max(0, Math.ceil((readyAt - now) / 1000));
}
