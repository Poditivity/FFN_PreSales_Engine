"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  wide?: boolean;
  /** Wider still, for long forms on tablet and desktop. Phones are full width either way. */
  xwide?: boolean;
  children: ReactNode;
}

// Shared admin modal shell — composed from existing FFN tokens only
// (color-mix derives the scrim from --surface-inverse rather than a new
// hardcoded rgba, same approach as the forms admin builder's modal).
export function Modal({ title, onClose, wide, xwide, children }: ModalProps) {
  return (
    <div className="app-modal-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="app-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: xwide ? "min(1040px, 100%)" : wide ? "min(760px, 100%)" : "min(520px, 100%)" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
          <h2 className="h2">{title}</h2>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
