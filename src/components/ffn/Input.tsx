"use client";

import { CalendarDays, Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { cx } from "./cx";
import { Field } from "./Field";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: "sm" | "md" | "lg";
  mono?: boolean;
}

export function Input({
  label,
  hint,
  error,
  required,
  size = "md",
  mono,
  className,
  id,
  type,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const isDate = type === "date";
  const inputRef = useRef<HTMLInputElement>(null);

  // The browser's own calendar icon is tiny, differs between browsers and is
  // invisible on a dark page, so a date field gets a visible button that opens
  // the same picker. Where a browser has no picker, the field is still typeable.
  function openCalendar() {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker refuses in some contexts (a cross-origin frame, for one); the field stays usable by typing.
    }
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      required={required}
      type={isPassword && revealed ? "text" : type}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error || hint ? `${inputId}-msg` : undefined}
      className={cx(
        "ffn-control",
        `ffn-control--${size}`,
        mono && "ffn-control--mono",
        (isPassword || isDate) && "ffn-control--with-toggle",
        isDate && "ffn-control--date",
        Boolean(error) && "ffn-control--invalid",
      )}
      {...rest}
    />
  );

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      {isPassword ? (
        <div className="ffn-password-wrap">
          {input}
          <button
            type="button"
            className="ffn-password-toggle"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            disabled={rest.disabled}
          >
            {revealed ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
      ) : isDate ? (
        <div className="ffn-password-wrap">
          {input}
          <button
            type="button"
            className="ffn-password-toggle"
            onClick={openCalendar}
            aria-label="Open calendar"
            disabled={rest.disabled || rest.readOnly}
          >
            <CalendarDays size={16} aria-hidden />
          </button>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
