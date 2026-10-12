"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "./cx";
import { Field } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Textarea({ label, hint, error, required, className, id, ...rest }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={textareaId} className={className}>
      <textarea
        id={textareaId}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${textareaId}-msg` : undefined}
        className={cx("ffn-control", "ffn-textarea", Boolean(error) && "ffn-control--invalid")}
        {...rest}
      />
    </Field>
  );
}
