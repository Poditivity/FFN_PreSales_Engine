"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

// Ported from the FFN design system's bundle.js Button — same classes and
// markup, rebuilt as a real component instead of loading the reference
// bundle (see .claude/skills/ffn-design-system/INSTALL.md).
export function Button({
  variant = "primary",
  size = "md",
  loading,
  block,
  iconLeft,
  iconRight,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={cx(
        "ffn-btn",
        `ffn-btn--${variant}`,
        `ffn-btn--${size}`,
        block && "ffn-btn--block",
        className,
      )}
      {...rest}
    >
      {loading ? <span className="ffn-spinner" /> : iconLeft}
      <span>{children}</span>
      {loading ? null : iconRight}
    </button>
  );
}
