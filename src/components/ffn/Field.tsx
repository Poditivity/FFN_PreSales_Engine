import type { ReactNode } from "react";
import { cx } from "./cx";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cx("ffn-field", className)}>
      {label && (
        <label className="ffn-field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ffn-field__req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="ffn-field__error" id={htmlFor ? `${htmlFor}-msg` : undefined}>
          {error}
        </p>
      ) : hint ? (
        <p className="ffn-field__hint" id={htmlFor ? `${htmlFor}-msg` : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
