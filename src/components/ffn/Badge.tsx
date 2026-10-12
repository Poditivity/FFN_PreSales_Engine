import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = true, className, children }: BadgeProps) {
  return (
    <span className={cx("ffn-badge", `ffn-badge--${tone}`, className)}>
      {dot && <span className="ffn-badge__dot" />}
      {children}
    </span>
  );
}
