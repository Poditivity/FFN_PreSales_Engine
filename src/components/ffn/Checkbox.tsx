"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cx } from "./cx";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ label, hint, className, id, disabled, checked, ...rest }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  return (
    <label
      className={cx("ffn-check", disabled && "ffn-check--disabled", className)}
      htmlFor={checkboxId}
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="ffn-sr"
        checked={checked}
        disabled={disabled}
        {...rest}
      />
      <span
        className={cx("ffn-check__box", checked && !disabled && "ffn-check__box--on")}
        aria-hidden="true"
      >
        {checked && <Check size={12} strokeWidth={1.75} />}
      </span>
      <span>
        <span className="ffn-check__text">{label}</span>
        {hint && (
          <span className="ffn-check__hint" style={{ display: "block" }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
