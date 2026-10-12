"use client";

import { useRef } from "react";
import { OTP_LENGTH, sanitizeDigits } from "./otp";

export interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Called once, when the sixth digit is entered by typing or pasting. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}

// Six single-digit boxes that behave as one field: typing moves forward,
// Backspace moves back, arrow keys move between boxes, and pasting a whole
// code fills them all. Built from the FFN control styles (ffn-control) and
// tokens only. It is an app component, not part of the design system.
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus, label = "6 digit code" }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  function focusBox(i: number) {
    const box = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))];
    box?.focus();
    box?.select();
  }

  function commit(next: string, focusIndex: number) {
    onChange(next);
    if (next.length === OTP_LENGTH && value.length !== OTP_LENGTH) onComplete?.(next);
    focusBox(focusIndex);
  }

  function handleChange(i: number, raw: string) {
    const entered = sanitizeDigits(raw);
    if (entered === "") {
      // The box was emptied (a delete or a non-digit): drop that digit.
      commit(value.slice(0, i) + value.slice(i + 1), i);
      return;
    }
    // One typed digit replaces the box; several (autofill, a fast paste) spill forward.
    const next = sanitizeDigits(value.slice(0, i) + entered + value.slice(i + 1));
    commit(next, Math.min(i + entered.length, OTP_LENGTH - 1));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      commit(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = sanitizeDigits(e.clipboardData.getData("text"));
    if (!pasted) return;
    e.preventDefault();
    commit(pasted, Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div role="group" aria-label={label} className="flex" style={{ gap: "var(--space-2)" }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`ffn-control ffn-control--lg${invalid ? " ffn-control--invalid" : ""}`}
          style={{
            width: "var(--control-lg)",
            minWidth: 0,
            flex: "1 1 0",
            padding: 0,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontVariantNumeric: "tabular-nums",
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          // Only the first box asks the browser for a texted or emailed code, which then arrives as one paste.
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid ? "true" : undefined}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          data-testid={`otp-${i}`}
        />
      ))}
    </div>
  );
}
