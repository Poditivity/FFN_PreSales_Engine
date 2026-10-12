"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Modal, Tooltip } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Deleting a form removes its public page for good, so it asks first. A form
 * that has received applications cannot be deleted at all (the database refuses
 * too): its submissions and leads would go with it, so the button explains and
 * points at closing the form instead.
 */
export function FormDeleteButton({
  id,
  title,
  submissionCount,
  redirectTo,
}: {
  id: string;
  title: string;
  submissionCount: number;
  /** Where to go after deleting, for the editor. The list just refreshes. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = submissionCount > 0;
  const blockedHint = "This form has submissions and is linked to leads, hubs and more, so it can't be deleted. Close it instead.";

  async function remove() {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await createBrowserSupabaseClient().from("forms").delete().eq("id", id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      {blocked ? (
        // A disabled button swallows hover, so the wrapper takes it and the
        // button lets the pointer through, with a plain cursor instead of the
        // browser's "not allowed" sign.
        <Tooltip label={blockedHint}>
          <Button
            variant="secondary"
            size="sm"
            disabled
            iconLeft={<Trash2 size={15} aria-hidden />}
            style={{ pointerEvents: "none" }}
          >
            Delete
          </Button>
        </Tooltip>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          title="Delete this form"
          iconLeft={<Trash2 size={15} aria-hidden />}
          onClick={() => setOpen(true)}
        >
          Delete
        </Button>
      )}
      {open && (
        <Modal title="Delete this form?" onClose={() => !deleting && setOpen(false)}>
          <p className="body" style={{ margin: 0 }}>
            <strong>{title || "Untitled form"}</strong> and its public link will be removed. This cannot be undone.
          </p>
          {error && <Alert tone="danger" title="Could not delete the form">{error}</Alert>}
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft={<Trash2 size={15} />} loading={deleting} onClick={remove}>
              Delete form
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
