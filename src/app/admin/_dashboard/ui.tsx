"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ffn/cx";
import type { ButtonSize, ButtonVariant } from "@/components/ffn";

// Clock for relative times ("5 min ago") and the greeting. It starts as
// null so the server render and the first browser render agree, then ticks
// every 30 seconds once mounted.
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

const noSubscribe = () => () => {};

/** Mac keyboards show Cmd K; everything else shows Ctrl K. False on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

/** A Next link styled as an FFN button, for actions that navigate. */
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  iconLeft,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx("ffn-btn", `ffn-btn--${variant}`, `ffn-btn--${size}`, className)}>
      {iconLeft}
      <span>{children}</span>
    </Link>
  );
}

export function Skeleton({ width = "100%", height }: { width?: string; height: string }) {
  return <span className="dash-skeleton" style={{ width, height }} aria-hidden />;
}

export function SectionError({ message }: { message: string }) {
  return (
    <p className="body-sm" role="alert" style={{ color: "var(--danger)", margin: 0 }}>
      Could not load this section. {message}
    </p>
  );
}

/** Label and value pair used under charts, value in mono. */
export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-1)", minWidth: 0 }}>
      <span className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span className="data-lg" style={{ color: "var(--ink)" }}>
        {value}
      </span>
      {note ? (
        <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}
