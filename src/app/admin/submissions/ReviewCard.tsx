"use client";

// One submission, reviewed on its own. Ported from build-fellowship's
// ReviewCard: identity up top, the engagement signal derived from field
// timings and keystrokes, then every answer with its own micro-stats, and the
// two things a reviewer leaves behind: a star rating and notes for the team.

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  ExternalLink,
  ListChecks,
  Mail,
  Phone,
  Type,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Select, Textarea } from "@/components/ffn";
import { FLAG_LABEL, formatAnswer, formatDuration, type FieldInsight } from "@/lib/forms/insights";
import { CONSENT_KEY } from "@/lib/forms/consent";
import { formatIST, utcToIST } from "@/lib/forms/ist";
import { SUBMISSION_STATUSES, type SubmissionEntry } from "@/lib/forms/submissionAnalysis";
import {
  BandBadge,
  BreakdownBar,
  Eyebrow,
  Metric,
  ScoreRing,
  SignalChip,
  StarRating,
  statusLabel,
  SubmissionStatusBadge,
} from "./parts";

const FLAG_TONE = { pasted: "warn", rushed: "warn", speedrun: "warn", detailed: "good", complete: "good" } as const;

function ContactLink({ icon: Icon, href, children }: { icon: LucideIcon; href: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="body-sm flex items-center"
      style={{ gap: "var(--space-2)", color: "var(--ink-muted)", maxWidth: "100%", minWidth: 0 }}
    >
      <Icon size={14} aria-hidden style={{ flexShrink: 0 }} />
      <span className="ffn-truncate">{children}</span>
    </a>
  );
}

function AnswerRow({ stat }: { stat: FieldInsight }) {
  const micro: string[] = [];
  if (stat.seconds) micro.push(`${stat.seconds}s`);
  if (stat.keys) micro.push(`${stat.keys} keys`);
  if (stat.words > 1) micro.push(`${stat.words} words`);

  return (
    <div style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--border)" }}>
      <div className="flex justify-between items-baseline" style={{ gap: "var(--space-3)" }}>
        <div className="body-sm" style={{ color: "var(--ink-muted)" }}>
          {stat.label}
        </div>
        <div className="data-sm" style={{ color: "var(--ink-subtle)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {micro.join(" · ")}
        </div>
      </div>
      <div
        className="body"
        style={{
          marginTop: "var(--space-1)",
          color: stat.answered ? "var(--ink)" : "var(--ink-subtle)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {!stat.answered ? (
          "Not answered"
        ) : stat.type === "file" && /^https:\/\//i.test(stat.text) ? (
          <a href={stat.text} target="_blank" rel="noreferrer noopener" style={{ color: "var(--brand)" }}>
            Open the uploaded file
          </a>
        ) : (
          formatAnswer(stat.value)
        )}
      </div>
      {(stat.pasted || stat.rushed) && (
        <div className="flex" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {stat.pasted && (
            <SignalChip tone="warn" title={`${stat.chars} characters but only ${stat.keys} keypresses`}>
              Likely pasted
            </SignalChip>
          )}
          {stat.rushed && (
            <SignalChip tone="warn" title={`${stat.chars} characters in ${stat.seconds}s`}>
              Rushed
            </SignalChip>
          )}
        </div>
      )}
    </div>
  );
}

export function ReviewCard({
  entry,
  index,
  total,
  onPrev,
  onNext,
  onRate,
  onStatusChange,
  onNotesSave,
  onResend,
  onClose,
}: {
  entry: SubmissionEntry;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onRate: (id: string, value: number | null) => void;
  onStatusChange: (id: string, value: string) => void;
  onNotesSave: (id: string, value: string) => void;
  onResend: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { row, identity, insights, flags } = entry;
  // The applicant's privacy consent, kept with their answers when they submitted.
  const consent = (row.data as Record<string, unknown> | null)?.[CONSENT_KEY] as { accepted?: boolean; at?: string } | undefined;
  const consentAt = consent?.accepted && typeof consent.at === "string" ? consent.at : null;
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSource, setShowSource] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Per-submission state (notes, resend message) starts fresh because the parent
  // keys this component on the submission id, so paging remounts it.

  // Keyboard: arrows page through, 1 to 5 rate, 0 clears, Escape goes back, but
  // never while the reviewer is typing into the notes box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "Escape") onClose();
      else if (e.key >= "1" && e.key <= "5") onRate(row.id, Number(e.key));
      else if (e.key === "0") onRate(row.id, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, onClose, onRate, row.id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    // Horizontal intent only, so vertical scrolling never pages the carousel.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onNext();
      else onPrev();
    }
  };

  const resend = async () => {
    setResending(true);
    setResendMsg(null);
    try {
      await onResend(row.id);
      setResendMsg({ ok: true, text: "Confirmation email sent." });
    } catch (err) {
      setResendMsg({ ok: false, text: err instanceof Error ? err.message : "Could not resend the email." });
    } finally {
      setResending(false);
    }
  };

  const saveNotes = () => {
    if (notes === (row.admin_notes ?? "")) return;
    onNotesSave(row.id, notes);
  };

  const { date, time } = row.created_at ? utcToIST(row.created_at) : { date: "—", time: "" };

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Carousel controls */}
      <div className="flex items-center justify-between" style={{ gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <button type="button" className="subs-navbtn" onClick={onPrev} aria-label="Previous submission" disabled={total <= 1}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>

        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div className="data" aria-live="polite">
            {index + 1} / {total}
          </div>
          <div className="caption subs-hint" style={{ marginTop: "var(--space-0\\.5)" }}>
            Swipe, use the arrow keys, or press 1 to 5 to rate.
          </div>
        </div>

        <button type="button" className="subs-navbtn" onClick={onNext} aria-label="Next submission" disabled={total <= 1}>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <article className="subs-panel" style={{ overflow: "hidden" }}>
        {/* Identity */}
        <div className="subs-section">
          <div className="flex justify-between items-start" style={{ gap: "var(--space-3)" }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="h1" style={{ margin: 0, wordBreak: "break-word" }}>
                {identity.name || "Unnamed applicant"}
              </h2>
              <div className="flex flex-wrap" style={{ gap: "var(--space-1) var(--space-4)", marginTop: "var(--space-2)" }}>
                <ContactLink icon={Mail} href={`mailto:${identity.email}`}>
                  {identity.email}
                </ContactLink>
                <ContactLink icon={Phone} href={`tel:${identity.phone}`}>
                  {identity.phone}
                </ContactLink>
                <ContactLink icon={ExternalLink} href={identity.linkedin}>
                  {identity.linkedin ? "LinkedIn profile" : ""}
                </ContactLink>
              </div>
              <div className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>
                {row.forms?.title || "Unknown form"} · <span className="data-sm">{date} {time}</span> IST
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-label="Back to list" onClick={onClose}>
              <X size={18} strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        {/* Review actions */}
        <div
          className="subs-section flex flex-wrap items-center"
          style={{ gap: "var(--space-4)", background: "var(--surface-sunken)" }}
        >
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <span className="label" style={{ color: "var(--ink-muted)" }}>
              Rating
            </span>
            <StarRating value={row.rating} onChange={(n) => onRate(row.id, n)} size={26} />
          </div>
          <div className="flex items-center" style={{ gap: "var(--space-3)", marginLeft: "auto" }}>
            <Select
              size="sm"
              aria-label="Status"
              value={row.status || "new"}
              options={SUBMISSION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
              onChange={(e) => onStatusChange(row.id, e.target.value)}
            />
          </div>
        </div>

        {/* Signal */}
        <div className="subs-section">
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-5)" }}>
            <ScoreRing score={insights.effortScore.total} band={insights.effortBand} />
            <div style={{ flex: 1, minWidth: "calc(var(--space-16) * 3.5)" }}>
              <div style={{ marginBottom: "var(--space-2)" }}>
                <BandBadge band={insights.effortBand} />
              </div>
              <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                <BreakdownBar label="Depth" value={insights.effortScore.depth} max={35} />
                <BreakdownBar label="Deliberation" value={insights.effortScore.deliberation} max={25} />
                <BreakdownBar label="Typed live" value={insights.effortScore.authenticity} max={25} />
                <BreakdownBar label="Completeness" value={insights.effortScore.completeness} max={15} />
              </div>
            </div>
          </div>

          {flags.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              {flags.map((f) => (
                <SignalChip key={f} tone={FLAG_TONE[f]}>
                  {FLAG_LABEL[f]}
                </SignalChip>
              ))}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-16) * 2), 1fr))",
              gap: "var(--space-2)",
              marginTop: "var(--space-4)",
            }}
          >
            <Metric icon={Clock} label="Time on form" value={formatDuration(insights.timeOnForm)} />
            <Metric icon={Zap} label="Per answer" value={insights.secondsPerAnswer ? `${insights.secondsPerAnswer}s` : "—"} />
            <Metric icon={Type} label="Words written" value={insights.totalWords} />
            <Metric
              icon={Clipboard}
              label="Typed live"
              value={insights.typedRatio === null ? "—" : `${Math.round(insights.typedRatio * 100)}%`}
              hint={insights.pastedFields.length ? `${insights.pastedFields.length} pasted` : undefined}
            />
            <Metric icon={ListChecks} label="Answered" value={`${insights.answeredFields}/${insights.totalFields}`} />
          </div>
        </div>

        {/* Answers */}
        <div className="subs-section" style={{ paddingTop: "var(--space-3)" }}>
          <Eyebrow style={{ paddingTop: "var(--space-3)" }}>Answers</Eyebrow>
          {insights.fields.map((stat) => (
            <AnswerRow key={stat.fieldId} stat={stat} />
          ))}
          {consentAt && (
            <p className="body-sm" style={{ color: "var(--ink-muted)", paddingTop: "var(--space-3)" }}>
              Agreed to the privacy policy on {formatIST(consentAt)}.
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="subs-section">
          <Textarea
            label="Notes for the team"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="What stood out? Saved when you click away."
          />
        </div>

        {/* Secondary actions */}
        <div className="subs-section flex flex-col" style={{ gap: "var(--space-3)" }}>
          <div className="flex flex-wrap" style={{ gap: "var(--space-3)" }}>
            <Button variant="secondary" size="sm" loading={resending} iconLeft={<Mail size={16} />} onClick={resend}>
              Resend confirmation email
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSource((v) => !v)} aria-expanded={showSource}>
              {showSource ? "Hide source and session" : "Source and session"}
            </Button>
          </div>

          {resendMsg && (
            <div
              className="body-sm flex items-center"
              role="status"
              style={{ gap: "var(--space-2)", color: resendMsg.ok ? "var(--success)" : "var(--danger)" }}
            >
              {resendMsg.ok && <Check size={14} aria-hidden />}
              {resendMsg.text}
            </div>
          )}

          {showSource && (
            <div className="data-sm flex flex-col" style={{ color: "var(--ink-muted)", gap: "var(--space-1)", wordBreak: "break-all" }}>
              <span>utm_source: {row.source.utm_source || "—"}</span>
              <span>utm_medium: {row.source.utm_medium || "—"}</span>
              <span>utm_campaign: {row.source.utm_campaign || "—"}</span>
              <span>referrer: {row.source.referrer || "—"}</span>
              <span>session: {row.session_id}</span>
              <span>ua: {row.source.user_agent || "—"}</span>
            </div>
          )}
        </div>
      </article>

      {/* Footer nav, so the reviewer never has to scroll back up */}
      <div className="flex items-center justify-between" style={{ gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        <Button variant="secondary" iconLeft={<ChevronLeft size={16} />} onClick={onPrev} disabled={total <= 1}>
          Previous
        </Button>
        <SubmissionStatusBadge status={row.status || "new"} />
        <Button iconRight={<ChevronRight size={16} />} onClick={onNext} disabled={total <= 1}>
          Next
        </Button>
      </div>
    </div>
  );
}
