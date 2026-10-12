"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button } from "@/components/ffn";
import { ConsentBox } from "@/components/forms/ConsentBox";
import { FieldRenderer } from "@/components/forms/FieldRenderer";
import { CONSENT_KEY, consentRecord, DEFAULT_PUBLIC_SETTINGS, type PublicFormSettings } from "@/lib/forms/consent";
import { uploadFormFile } from "@/lib/forms/fileUpload";
import { trackFormComplete, trackFormDrop, trackFormStart } from "@/lib/forms/analytics";
import {
  entryNodeId,
  estimateSteps,
  getNode,
  isChoiceField,
  nextNodeId,
  normalizeSchema,
  type FlowNode,
} from "@/lib/forms/flowModel";
import { fileConfigOf, isEmailField, validateField } from "@/lib/forms/formLogic";
import type { Form } from "@/lib/forms/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormSubmission } from "@/lib/forms/useFormSubmission";

// Ported from build-fellowship's app/src/components/forms/FlowRenderer.jsx:
// a one-question-at-a-time flow driven by the node/edge graph in
// form.schema, instead of a single long page. Branching, progress, and the
// end-node redirect/message override all match the source; styling is FFN's.

function notifySubmissionEmails(formId: string, sessionId: string) {
  const supabase = createBrowserSupabaseClient();
  supabase.functions.invoke("send-submission-email", { body: { formId, sessionId } }).catch(() => {});
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function FormRenderer({
  form,
  preview = false,
  settings = DEFAULT_PUBLIC_SETTINGS,
}: {
  form: Form;
  preview?: boolean;
  /** The privacy notice, policy link and file limit set on the Settings page. */
  settings?: PublicFormSettings;
}) {
  const graph = useMemo(() => normalizeSchema(form.schema), [form.schema]);
  const { nodes, edges } = graph;
  const totalSteps = useMemo(() => estimateSteps(nodes, edges), [nodes, edges]);

  const tracker = useFormSubmission(preview ? null : form.id);
  const [currentId, setCurrentId] = useState<string | null>(() => entryNodeId(nodes, edges));
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  // Set when someone skips a choice question that sends them to the end, so the
  // consent box appears and the form can still be submitted.
  const [consentPrompted, setConsentPrompted] = useState(false);
  const [result, setResult] = useState<{ message: string; redirect: string } | null>(null);
  const startedRef = useRef(false);
  const lastLabel = useRef<string | null>(null);

  const current: FlowNode | null = getNode(nodes, currentId);
  const field = current?.type === "question" ? current.data.field ?? null : null;

  useEffect(() => {
    if (preview) return;
    const onUnload = () => {
      if (startedRef.current && !result) {
        trackFormDrop(form.id, form.slug, lastLabel.current, tracker.timeOnFormSeconds());
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [form.id, form.slug, result, tracker, preview]);

  // Show the thank-you message first so the applicant knows the submission
  // went through, then redirect — jumping straight to an external URL left
  // no confirmation that the form was actually completed.
  useEffect(() => {
    if (!result?.redirect || preview) return;
    const timer = setTimeout(() => {
      window.location.href = result.redirect;
    }, 3000);
    return () => clearTimeout(timer);
  }, [result, preview]);

  function begin() {
    if (!startedRef.current) {
      startedRef.current = true;
      if (!preview) trackFormStart(form.id, form.slug);
    }
  }

  function setValue(value: unknown) {
    if (!field) return;
    begin();
    setAnswers((prev) => {
      const next = { ...prev, [field.id]: value };
      tracker.setData(next);
      return next;
    });
    if (error) setError("");
    setConsentPrompted(false);
  }

  function resolveNext(answer: unknown) {
    if (!current) return { nid: null, node: null };
    const nid = nextNodeId(current, answer, edges);
    return { nid, node: getNode(nodes, nid) };
  }

  // Where a choice question leads depends on the answer, so until it is answered
  // nobody knows whether this is the last question. Only a question that is
  // certain to be the last one asks for consent: never the one before it.
  const awaitingChoice = !!field && isChoiceField(field.type) && !hasAnswer(answers[field.id]);
  const routesToEnd = (() => {
    if (!current) return true;
    const { nid, node } = resolveNext(answers[field?.id ?? ""]);
    return !nid || node?.type === "end";
  })();
  const nextIsTerminal = routesToEnd && !awaitingChoice;
  const showConsent = nextIsTerminal || consentPrompted;

  async function finish(endNode: FlowNode | null) {
    setSubmitting(true);
    const seconds = tracker.timeOnFormSeconds();
    try {
      tracker.markCompleted();
      // The applicant's consent is kept with their answers, with when they gave it.
      tracker.setData({ ...answers, [CONSENT_KEY]: consentRecord(settings) });
      const submissionId = await tracker.flush({ partial: false, completed: true });
      if (!preview) {
        const submittedSessionId = tracker.sessionId;
        trackFormComplete(form.id, form.slug, seconds);
        if (submittedSessionId && (submissionId || true)) {
          notifySubmissionEmails(form.id, submittedSessionId);
        }
      }

      const message = endNode?.data.message || form.thank_you_message || "Thank you for your submission!";
      const redirect = endNode?.data.redirect_url || (form.post_submit_action === "redirect" ? form.redirect_url ?? "" : "");
      setResult({ message, redirect });
    } catch (err) {
      // The database refuses a finished submission with a bad email address; say why.
      const reason = (err as { message?: string } | null)?.message;
      setError(
        reason === "Enter a valid email address"
          ? "Enter a valid email address. Go back to fix it."
          : "We could not submit your application. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (!field || !current) return;
    const err = validateField(field, answers[field.id]);
    if (err) {
      setError(err);
      return;
    }
    const { nid, node } = resolveNext(answers[field.id]);
    if (!nid || node?.type === "end") {
      if (!consent) {
        setConsentPrompted(true);
        setConsentError("Agree to the privacy policy to submit.");
        return;
      }
      await finish(node);
      return;
    }
    setHistory((h) => [...h, currentId!]);
    setCurrentId(nid);
    setError("");
    setConsentPrompted(false);
  }

  function handleBack() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setCurrentId(prev);
      setError("");
      setConsentPrompted(false);
      return h.slice(0, -1);
    });
  }

  const progress = result ? 100 : Math.min(95, Math.round((history.length / Math.max(1, totalSteps)) * 100));

  if (result) {
    return (
      <main
        className="mx-auto w-full flex min-h-screen flex-col items-center justify-center text-center"
        style={{ maxWidth: 480, padding: "var(--space-6)", gap: "var(--space-4)" }}
      >
        <Image src="/logos/ffn-lockup-on-light.png" alt="Founders First Network" width={120} height={120} />
        <h1 className="display-md">Thank you</h1>
        <p className="body-lg" style={{ color: "var(--ink-muted)" }} data-testid="submission-confirmation">
          {result.message}
        </p>
      </main>
    );
  }

  if (!current || !field) {
    return (
      <main className="mx-auto w-full flex min-h-screen items-center justify-center">
        <p className="body" style={{ color: "var(--ink-muted)" }}>
          This form has no questions yet.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full" style={{ maxWidth: "var(--prose-max)", padding: "var(--space-10) var(--space-6)" }}>
      <div className="flex flex-col items-start" style={{ gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        <Image src="/logos/ffn-lockup-on-light.png" alt="Founders First Network" width={120} height={120} />
        <h1 className="display-md">{form.title}</h1>
        {form.description && (
          <p className="body-lg" style={{ color: "var(--ink-muted)" }}>
            {form.description}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: "var(--space-2)" }}>
          <span className="eyebrow" style={{ color: "var(--ink-muted)" }}>
            Question {history.length + 1}
          </span>
          <span className="eyebrow" style={{ color: "var(--brand)" }}>
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: "var(--surface-sunken)",
            borderRadius: "var(--radius-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--brand-solid)",
              borderRadius: "var(--radius-full)",
              transition: "width 0.35s ease",
            }}
          />
        </div>
      </div>

      <form
        noValidate
        className="flex flex-col"
        style={{ gap: "var(--space-6)" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!submitting && !uploading) void handleNext();
        }}
      >
        <FieldRenderer
          field={field}
          value={answers[field.id]}
          error={error || undefined}
          onChange={setValue}
          onFocus={() => {
            begin();
            tracker.onFieldFocus(field.id);
            lastLabel.current = field.label;
          }}
          onBlur={() => {
            tracker.onFieldBlur(field.id);
            // An address is checked as soon as the applicant leaves the field, not
            // only on Next, so a typo is caught while it is in front of them.
            const typed = answers[field.id];
            if (isEmailField(field) && typeof typed === "string" && typed.trim()) {
              const problem = validateField(field, typed);
              if (problem) setError(problem);
            }
          }}
          onKeystroke={() => tracker.onKeystroke(field.id)}
          onBusyChange={setUploading}
          onUploadFile={
            UUID.test(form.id)
              ? (file) =>
                  uploadFormFile({
                    formId: form.id,
                    fieldId: field.id,
                    sessionId: tracker.sessionId,
                    file,
                    config: fileConfigOf(field),
                  })
              : undefined
          }
        />

        {error && (
          <Alert tone="danger" title="Check your answer">
            {error}
          </Alert>
        )}

        {showConsent && (
          <ConsentBox
            settings={settings}
            checked={consent}
            error={consentError}
            onChange={(checked) => {
              setConsent(checked);
              if (checked) setConsentError("");
            }}
          />
        )}

        <div className="flex items-center justify-between" style={{ gap: "var(--space-3)" }}>
          {history.length > 0 ? (
            <Button variant="secondary" size="lg" onClick={handleBack} disabled={submitting || uploading}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" type="submit" data-testid="submit-button" loading={submitting} disabled={uploading}>
            {showConsent ? "Submit" : "Next"}
          </Button>
        </div>
      </form>
    </main>
  );
}
