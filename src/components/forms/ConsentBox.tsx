"use client";

import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ffn";
import { CONSENT_LABEL, type PublicFormSettings } from "@/lib/forms/consent";

// The privacy consent at the end of every public form: the team's notice in a
// box, a link to the full policy when there is one, and the checkbox. The form
// cannot be submitted until it is ticked.
export function ConsentBox({
  settings,
  checked,
  error,
  onChange,
}: {
  settings: PublicFormSettings;
  checked: boolean;
  error?: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }} data-testid="privacy-consent">
      <span className="eyebrow" style={{ color: "var(--ink-muted)" }}>
        Privacy
      </span>
      <div
        tabIndex={0}
        role="region"
        aria-label="Privacy notice"
        className="body-sm"
        style={{
          maxHeight: "calc(var(--space-16) * 3)",
          overflowY: "auto",
          padding: "var(--space-4)",
          background: "var(--surface-sunken)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--ink-muted)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {settings.privacyText}
      </div>
      {settings.privacyUrl && (
        <a
          href={settings.privacyUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="body-sm flex items-center"
          style={{ gap: "var(--space-1)", color: "var(--brand)", width: "fit-content" }}
        >
          Read the full privacy policy <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}
      <Checkbox
        data-testid="privacy-consent-checkbox"
        label={CONSENT_LABEL}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {error && (
        <p className="ffn-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
