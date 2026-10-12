"use client";

import { Phone } from "lucide-react";
import { OPEN_CALL_EVENT } from "./Communications";

/** The hero's shortcut: opens the call form in the composer card and scrolls to it. */
export function LogCallButton() {
  return (
    <button type="button" className="lead-btn" onClick={() => window.dispatchEvent(new Event(OPEN_CALL_EVENT))}>
      <Phone size={15} aria-hidden /> Log a call
    </button>
  );
}
