"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { Checkbox } from "./Checkbox";
import { cx } from "./cx";
import { Field } from "./Field";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label?: ReactNode;
  options: SelectOption[];
  /** The ticked values. Empty means no restriction. */
  value: string[];
  onChange: (value: string[]) => void;
  /** What the control reads when nothing is ticked, such as "All forms". */
  allLabel: string;
  /** Plural noun for the summary once several are ticked, such as "forms". */
  noun: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Looks like Select, but a list of ticks opens under it so more than one option can be chosen. */
export function MultiSelect({ label, options, value, onChange, allLabel, noun, size = "md", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const chosen = options.filter((o) => value.includes(o.value));
  const summary = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : `${chosen.length} ${noun}`;

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Field label={label} htmlFor={id} className={className}>
      <span className="ffn-select-wrap" style={{ position: "relative" }}>
        <button
          id={id}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          className={cx("ffn-control", "ffn-select", `ffn-control--${size}`)}
          style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          onClick={() => setOpen((v) => !v)}
        >
          {summary}
        </button>
        <span className="ffn-select-wrap__caret">
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        {open && (
          <>
            <div className="subs-scrim" onClick={() => setOpen(false)} />
            <div
              className="subs-menu"
              role="group"
              aria-label={typeof label === "string" ? label : undefined}
              style={{
                right: "auto",
                left: 0,
                width: "max(100%, calc(var(--space-16) * 4))",
                maxHeight: "calc(var(--space-16) * 5)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
              }}
            >
              {options.map((o) => (
                <Checkbox key={o.value} label={o.label} checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              ))}
              {value.length > 0 && (
                <button type="button" className="label-sm" style={{ alignSelf: "flex-start", color: "var(--brand)", textDecoration: "underline" }} onClick={() => onChange([])}>
                  Clear
                </button>
              )}
            </div>
          </>
        )}
      </span>
    </Field>
  );
}
