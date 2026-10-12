import type { ReactNode } from "react";
import { HUB_CSS } from "@/app/hub/[token]/hubStyles";

// Shows a hub section the way an applicant sees it. The applicant hub is always
// light, so this frame is always light too, even when the admin is in dark mode:
// a preview that followed the admin's theme would show something the applicant
// never gets. It carries the hub's own styles and the light tokens, scoped to
// the frame, and trims the section's page-sized padding to fit an editor.
export function HubSectionFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="light"
      className="hub-section-frame"
      style={{ colorScheme: "light", background: "var(--surface-page)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}
    >
      <style>{HUB_CSS}</style>
      <style>{`.hub-section-frame .hub-section{padding-block:var(--space-8)}.hub-section-frame .hub-wrap{padding-inline:var(--space-6)}`}</style>
      <div className="ffn-hub">{children}</div>
    </div>
  );
}
