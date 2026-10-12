import type { ReactNode } from "react";
import { cx } from "./cx";

// Ported from the FFN design system's bundle.js (ActivityTimeline — see
// .claude/skills/ffn-design-system/components/ActivityTimeline/README.md).
// Newest first; the dot tone marks the kind of event, not its sentiment.

export type ActivityTone = "brand" | "success" | "warning" | "danger";

export interface ActivityItem {
  id?: string;
  title: ReactNode;
  meta?: ReactNode;
  note?: ReactNode;
  tone?: ActivityTone;
}

export interface ActivityTimelineProps {
  items: ActivityItem[];
  className?: string;
}

export function ActivityTimeline({ items, className }: ActivityTimelineProps) {
  return (
    <ol className={cx("ffn-timeline", className)}>
      {items.map((it, i) => (
        <li key={it.id ?? i} className="ffn-timeline__item">
          <span className="ffn-timeline__rail" aria-hidden="true">
            <span className={cx("ffn-timeline__dot", it.tone && `ffn-timeline__dot--${it.tone}`)} />
            {i < items.length - 1 ? <span className="ffn-timeline__line" /> : null}
          </span>
          <div className="ffn-timeline__body ffn-grow">
            <p className="ffn-timeline__title">{it.title}</p>
            {it.meta ? <p className="ffn-timeline__meta">{it.meta}</p> : null}
            {it.note ? <p className="ffn-timeline__note">{it.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
