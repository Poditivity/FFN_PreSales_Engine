"use client";

import type { ChangeEventHandler, ReactNode } from "react";
import { cx } from "./cx";

export interface SwitchProps {
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

// Ported from the FFN design system's bundle.js (Switch — see
// .claude/skills/ffn-design-system/components/Switch/README.md). Use it only
// where the change applies at once and there is no save button.
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <label className={cx("ffn-switch", className)}>
      <input type="checkbox" role="switch" className="ffn-sr" checked={checked} disabled={disabled} onChange={onChange} />
      <span className={cx("ffn-switch__track", checked && "ffn-switch__track--on")} aria-hidden="true">
        <span className="ffn-switch__thumb" />
      </span>
      {label ? <span className="ffn-check__text">{label}</span> : null}
    </label>
  );
}
