import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cx } from "./cx";

// Ported from the FFN design system's bundle.js (StatCard — see
// .claude/skills/ffn-design-system/components/StatCard/README.md). The value
// arrives pre-formatted; direction describes the number, not whether the
// news is good, so the note should say what it is compared against.

export type StatDirection = "up" | "down" | "flat";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  direction?: StatDirection;
  note?: ReactNode;
  className?: string;
}

const ARROW = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

export function StatCard({ label, value, delta, direction = "flat", note, className }: StatCardProps) {
  const Arrow = ARROW[direction];
  return (
    <article className={cx("ffn-stat", className)}>
      <p className="ffn-stat__label">{label}</p>
      <div className="ffn-stat__row">
        <span className="ffn-stat__value">{value}</span>
        {delta ? (
          <span className={cx("ffn-stat__delta", `ffn-stat__delta--${direction}`)}>
            <Arrow size={14} strokeWidth={1.75} aria-hidden />
            <span className="ffn-sr">{direction === "flat" ? "No change" : direction === "up" ? "Up" : "Down"}</span>
            {delta}
          </span>
        ) : null}
      </div>
      {note ? <p className="ffn-stat__note">{note}</p> : null}
    </article>
  );
}
