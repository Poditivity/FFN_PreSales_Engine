"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A hover and focus label for an icon-only control. The browser's own title
// tooltip is slow, never shows on touch and is easy to miss, so an icon that
// stands alone gets this instead (the brand book asks for a tooltip on every
// icon without a visible label). It is drawn in a portal at the document root so
// a table's scroll container cannot clip it, and it flips below the control when
// there is no room above.
const GAP = 8;

export function Tooltip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  // Place the tip once it exists, so its own size can be measured.
  useEffect(() => {
    if (!open || !anchor.current || !tip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(a.left + a.width / 2 - t.width / 2, margin), window.innerWidth - t.width - margin);
    const above = a.top - t.height - GAP;
    setPos({ left, top: above >= margin ? above : a.bottom + GAP });
  }, [open, label]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  return (
    <span
      ref={anchor}
      className={className ? `ffn-tooltip-anchor ${className}` : "ffn-tooltip-anchor"}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tip}
            id={id}
            role="tooltip"
            className="ffn-tooltip"
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
