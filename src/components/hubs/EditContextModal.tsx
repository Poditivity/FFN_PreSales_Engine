"use client";

import { useState } from "react";
import { Alert, Button, Input, Modal } from "@/components/ffn";
import { isValidEmail } from "@/lib/forms/formLogic";
import { updateHubContext } from "@/lib/hubs/hubs";
import type { Hub } from "@/lib/hubs/types";

// Edits a hub's Lead Context fields, plus — only when the hub has no lead —
// its own applicant identity (a lead's own name/email is never edited here;
// it lives on the lead). Shared by ProofHubCard and the admin-wide Hubs
// list, same reuse rule as CreateHubModal.
export function EditContextModal({
  hub,
  onClose,
  onSaved,
}: {
  hub: Hub;
  onClose: () => void;
  onSaved: (hub: Hub) => void;
}) {
  const standalone = !hub.lead_id;
  const [applicantName, setApplicantName] = useState(hub.applicant_name ?? "");
  const [applicantEmail, setApplicantEmail] = useState(hub.applicant_email ?? "");
  const [emailError, setEmailError] = useState("");
  const [applicantWhatsapp, setApplicantWhatsapp] = useState(hub.applicant_whatsapp ?? "");
  const [startupName, setStartupName] = useState(hub.startup_name ?? "");
  const [founderStage, setFounderStage] = useState(hub.founder_stage ?? "");
  const [currentContext, setCurrentContext] = useState(hub.current_context ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (standalone && !applicantName.trim()) {
      setError("A name is required.");
      return;
    }
    if (standalone && !applicantEmail.trim()) {
      setError("An email is required to send a standalone hub.");
      return;
    }
    if (standalone && !isValidEmail(applicantEmail)) {
      setEmailError("Enter a valid email address");
      setError("Check the email address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateHubContext(hub.id, {
        startup_name: startupName.trim() || null,
        founder_stage: founderStage.trim() || null,
        current_context: currentContext.trim() || null,
        ...(standalone
          ? {
              applicant_name: applicantName.trim() || null,
              applicant_email: applicantEmail.trim() || null,
              applicant_whatsapp: applicantWhatsapp.trim() || null,
            }
          : {}),
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={standalone ? "Applicant & context" : "Lead context"} onClose={onClose}>
      {standalone && (
        <>
          <Input label="Applicant name" required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
          <div className="flex flex-wrap" style={{ gap: "var(--space-3)" }}>
            <Input
              label="Email"
              type="email"
              required
              value={applicantEmail}
              onChange={(e) => {
                setApplicantEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              error={emailError || undefined}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Input
              label="WhatsApp number"
              placeholder="9876543210"
              value={applicantWhatsapp}
              onChange={(e) => setApplicantWhatsapp(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
        </>
      )}

      <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
        Used to personalize this hub&apos;s Welcome block. All optional.
      </p>
      <Input label="Startup name" value={startupName} onChange={(e) => setStartupName(e.target.value)} />
      <Input label="Founder stage" value={founderStage} onChange={(e) => setFounderStage(e.target.value)} />
      <Input label="Current context / problem" value={currentContext} onChange={(e) => setCurrentContext(e.target.value)} />

      {error && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}

      <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={save}
          loading={saving}
          disabled={standalone && (!applicantName.trim() || !applicantEmail.trim())}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}
