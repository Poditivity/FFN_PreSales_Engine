"use client";

import { Check, Copy, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ffn";
import { copyToClipboard } from "@/lib/messaging/whatsapp";

const INACTIVE_HINT = "Only active forms have a public page.";

/**
 * Copy link and Preview for one row of the forms list. Copy link points at the
 * public form page, which only exists while the form is active, so it is
 * disabled for drafts and closed forms. Preview opens the admin preview page,
 * which works for any status and saves nothing. The link carries this site's
 * address, so it is built in the browser.
 */
export function FormLinkActions({ id, slug, active }: { id: string; slug: string; active: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "blocked">("idle");
  const path = `/forms/${slug}`;

  async function copy() {
    const ok = await copyToClipboard(`${window.location.origin}${path}`);
    setState(ok ? "copied" : "blocked");
    setTimeout(() => setState("idle"), 1800);
  }

  const copyLabel = state === "copied" ? "Copied" : state === "blocked" ? "Copy not allowed" : "Copy link";

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={!active}
        title={active ? undefined : INACTIVE_HINT}
        iconLeft={state === "copied" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        onClick={copy}
      >
        {copyLabel}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        title="Opens the form without saving anything"
        iconLeft={<Eye size={15} aria-hidden />}
        onClick={() => window.open(`/admin/forms/${id}/preview`, "_blank", "noopener,noreferrer")}
      >
        Preview
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Link copied" : ""}
      </span>
    </>
  );
}
