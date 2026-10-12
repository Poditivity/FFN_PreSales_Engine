"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "./cx";
import { Field } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  required,
  size = "md",
  options,
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId} className={className}>
      <span className="ffn-select-wrap">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error || hint ? `${selectId}-msg` : undefined}
          className={cx("ffn-control", "ffn-select", `ffn-control--${size}`, Boolean(error) && "ffn-control--invalid")}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ffn-select-wrap__caret">
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </span>
    </Field>
  );
}
