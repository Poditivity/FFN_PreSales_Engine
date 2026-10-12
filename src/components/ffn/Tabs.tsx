"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange?: (id: string) => void;
  className?: string;
}

// Ported from the FFN design system's bundle.js Tabs — same classes and
// markup as every other ffn/* component (see components/README.md: "Views
// of the same collection... up to five tabs").
export function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div className={cx("ffn-tabs", className)} role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cx("ffn-tab", isActive && "ffn-tab--active")}
            onClick={onChange ? () => onChange(item.id) : undefined}
          >
            {item.label}
            {typeof item.count === "number" && <span className="ffn-tab__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
