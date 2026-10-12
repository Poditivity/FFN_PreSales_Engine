import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline, Avatar, Badge, Card, stageDef } from "@/components/ffn";
import type { Track } from "@/lib/content/types";
import { extractFields } from "@/lib/forms/flowModel";
import {
  activeFlags,
  computeSubmissionInsights,
  EFFORT_BAND_LABEL,
  FLAG_LABEL,
  formatDuration,
  orderedFields,
  resolveIdentity,
  type FieldTiming,
} from "@/lib/forms/insights";
import { formatIST } from "@/lib/forms/ist";
import { EMPTY_SOURCE } from "@/lib/forms/submissionAnalysis";
import { loadSources } from "@/lib/forms/submissionsData";
import { CALL_SELECT, callsWord, describeCalls, summarizeCalls, type LeadCall } from "@/lib/leads/calls";
import { ALL_LEAD_STAGES, type LeadStage, type LeadStageHistory } from "@/lib/leads/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BreakdownBar, ScoreRing, SignalChip, StarRating, SubmissionStatusBadge } from "../../submissions/parts";
import { Communications } from "./Communications";
import { CopyWhatsAppButton } from "./CopyWhatsAppButton";
import { LogCallButton } from "./LogCallButton";
import { OwnerSelect } from "./OwnerSelect";
import { ProofHubCard } from "./ProofHubCard";
import { StageControl } from "./StageControl";

interface HistoryRow extends LeadStageHistory {
  profiles: { email: string } | null;
}

interface LeadRow {
  id: string;
  stage: LeadStage;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  form_submissions: {
    id: string;
    session_id: string;
    data: Record<string, unknown>;
    created_at: string;
    field_timings: Record<string, FieldTiming> | null;
    keystroke_counts: Record<string, number> | null;
    time_on_form_seconds: number | null;
    status: string | null;
    rating: number | null;
    admin_notes: string | null;
    forms: { id: string; title: string; slug: string; schema: unknown };
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from an ISO timestamp to now. A server page renders once per request, so "now" is the request time. */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div>
      <dt className="caption" style={{ color: "var(--ink-subtle)" }}>
        {label}
      </dt>
      <dd className="body-sm" style={{ margin: 0, color: "var(--ink)", overflowWrap: "anywhere" }}>
        {children}
      </dd>
    </div>
  );
}

export default async function LeadDetailPage({ params }: PageProps<"/admin/leads/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: leadRow, error } = await supabase
    .from("leads")
    .select(
      "*, form_submissions(id, session_id, data, created_at, field_timings, keystroke_counts, time_on_form_seconds, status, rating, admin_notes, forms(id, title, slug, schema))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !leadRow) notFound();
  const lead = leadRow as unknown as LeadRow;
  const sub = lead.form_submissions;

  const [{ data: history }, { data: team }, { data: tracks }, sources, { data: callRows }, { data: auth }] = await Promise.all([
    supabase
      .from("lead_stage_history")
      .select("*, profiles(email)")
      .eq("lead_id", id)
      .order("changed_at", { ascending: true })
      .returns<HistoryRow[]>(),
    supabase.from("profiles").select("id, email, full_name").in("role", ["staff", "admin"]).order("email"),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
    loadSources(supabase, sub.session_id ? [sub.session_id] : []),
    supabase
      .from("lead_calls")
      .select(CALL_SELECT)
      .eq("lead_id", id)
      .order("called_at", { ascending: false })
      .returns<LeadCall[]>(),
    supabase.auth.getUser(),
  ]);
  const { data: hubRow } = await supabase
    .from("hubs")
    .select("token")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ token: string }>();
  const hubToken = hubRow?.token ?? null;
  const currentUserId = auth.user?.id ?? null;
  const { data: me } = currentUserId
    ? await supabase.from("profiles").select("is_super_admin").eq("id", currentUserId).maybeSingle()
    : { data: null };
  const calls = callRows ?? [];
  const callSummary = summarizeCalls(calls);
  const callBreakdown = describeCalls(callSummary.byStage, ALL_LEAD_STAGES);

  let fields = orderedFields(sub.forms.schema);
  if (fields.length === 0) fields = extractFields(sub.forms.schema);
  const identity = resolveIdentity(sub.data, fields);
  const insights = computeSubmissionInsights({
    fields,
    data: sub.data,
    fieldTimings: sub.field_timings ?? {},
    keystrokeCounts: sub.keystroke_counts ?? {},
    timeOnFormSeconds: sub.time_on_form_seconds,
  });
  const flags = activeFlags(insights);
  const source = sources.get(sub.session_id) ?? EMPTY_SOURCE;

  const changes = history ?? [];
  const enteredStage = [...changes].reverse().find((h) => h.to_stage === lead.stage)?.changed_at ?? lead.created_at;
  const daysInStage = daysSince(enteredStage);
  const displayName = identity.name || identity.email || "Lead";
  const stage = stageDef(lead.stage);

  const timeline = [...changes].reverse().map((entry) => ({
    id: entry.id,
    title: entry.from_stage ? `${stageDef(entry.from_stage).label} to ${stageDef(entry.to_stage).label}` : `Created at ${stageDef(entry.to_stage).label}`,
    meta: `${formatIST(entry.changed_at)} · ${entry.profiles?.email ?? "System"}`,
    tone: (stageDef(entry.to_stage).tone === "neutral" ? "brand" : stageDef(entry.to_stage).tone) as "brand" | "success" | "warning" | "danger",
  }));

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <section className="lead-hero" aria-label="Lead summary">
        <div className="flex items-start justify-between flex-wrap" style={{ gap: "var(--space-5)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-4)", minWidth: 0 }}>
            <Link href="/admin/leads" className="lead-btn lead-btn--icon" aria-label="Back to leads">
              <ArrowLeft size={16} strokeWidth={1.75} />
            </Link>
            <Avatar name={displayName} size="lg" />
            <div style={{ minWidth: 0 }}>
              <p className="eyebrow" style={{ margin: 0, textTransform: "uppercase", color: "color-mix(in srgb, var(--on-inverse) 68%, transparent)" }}>
                Lead · {sub.forms.title}
              </p>
              <h1 className="h1" style={{ margin: "var(--space-1) 0 var(--space-2)", color: "var(--on-inverse)", overflowWrap: "anywhere" }}>
                {displayName}
              </h1>
              <div className="flex flex-wrap" style={{ gap: "var(--space-2) var(--space-5)" }}>
                {identity.email && (
                  <a className="lead-hero__link body-sm" href={`mailto:${identity.email}`}>
                    <Mail size={14} aria-hidden /> {identity.email}
                  </a>
                )}
                {identity.phone && (
                  <a className="lead-hero__link body-sm" href={`tel:${identity.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone size={14} aria-hidden /> <span className="data-sm">{identity.phone}</span>
                  </a>
                )}
                {identity.linkedin && (
                  <a className="lead-hero__link body-sm" href={/^https?:\/\//i.test(identity.linkedin) ? identity.linkedin : `https://${identity.linkedin}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
            <a href="#compose" className="lead-btn lead-btn--primary">
              <Mail size={15} aria-hidden /> Write to this lead
            </a>
            <LogCallButton />
            <CopyWhatsAppButton name={identity.name} hubToken={hubToken} />
          </div>
        </div>

        <div className="lead-tiles" style={{ marginTop: "var(--space-6)" }}>
          <div className="lead-tile">
            <p className="lead-tile__label caption">Stage</p>
            <p className="lead-tile__value data-lg">{stage.label}</p>
            <p className="lead-tile__note caption">{stage.hint}</p>
          </div>
          <div className="lead-tile">
            <p className="lead-tile__label caption">Effort score</p>
            <p className="lead-tile__value data-lg">{insights.effortScore.total}</p>
            <p className="lead-tile__note caption">{EFFORT_BAND_LABEL[insights.effortBand]}</p>
          </div>
          <div className="lead-tile">
            <p className="lead-tile__label caption">In this stage</p>
            <p className="lead-tile__value data-lg">{daysInStage}d</p>
            <p className="lead-tile__note caption">Since {formatIST(enteredStage).slice(0, 10)}</p>
          </div>
          <div className="lead-tile">
            <p className="lead-tile__label caption">Calls</p>
            <p className="lead-tile__value data-lg">{callSummary.total}</p>
            <p className="lead-tile__note caption">
              {callSummary.total === 0 ? "Not called yet" : callBreakdown || callsWord(callSummary.total)}
            </p>
          </div>
          <div className="lead-tile">
            <p className="lead-tile__label caption">Applied</p>
            <p className="lead-tile__value data-lg">{formatIST(sub.created_at).slice(0, 10)}</p>
            <p className="lead-tile__note caption">{formatIST(sub.created_at).slice(11)}</p>
          </div>
          <div className="lead-tile">
            <p className="lead-tile__label caption">Answered</p>
            <p className="lead-tile__value data-lg">
              {insights.answeredFields}/{insights.totalFields}
            </p>
            <p className="lead-tile__note caption">{Math.round(insights.completeness * 100)}% complete</p>
          </div>
        </div>
      </section>

      <Card title="Stage" subtitle="Move this lead to any stage, in any order. Each move is logged, and sends the stage's email if a rule is on.">
        <StageControl leadId={id} stage={lead.stage} callsByStage={callSummary.byStage} />
      </Card>

      <div className="lead-grid">
        <div className="flex flex-col" style={{ gap: "var(--space-5)", minWidth: 0 }}>
          <Communications
            recipient={{
              leadId: id,
              name: identity.name,
              email: identity.email,
              phone: identity.phone,
              stage: lead.stage,
              formId: sub.forms.id,
              programTitle: sub.forms.title,
              hubToken,
            }}
            calls={calls}
            currentUserId={currentUserId}
            isSuperAdmin={!!me?.is_super_admin}
          />

          <Card title="Application" subtitle={`${sub.forms.title}. ${insights.answeredFields} of ${insights.totalFields} questions answered.`}>
            <dl className="lead-answers">
              {insights.fields.map((f) => {
                const long = f.text.length > 80 || f.text.includes("\n") || f.type === "textarea";
                return (
                  <div key={f.fieldId} className={long ? "lead-answers__wide" : undefined}>
                    <dt className="caption" style={{ color: "var(--ink-subtle)" }}>
                      {f.label}
                    </dt>
                    <dd
                      className="body"
                      style={{ margin: 0, color: f.answered ? "var(--ink)" : "var(--ink-subtle)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {f.answered ? f.text : "Not answered"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </div>

        <div className="flex flex-col" style={{ gap: "var(--space-5)", minWidth: 0 }}>
          <Card title="Details">
            <dl className="flex flex-col" style={{ gap: "var(--space-3)", margin: 0 }}>
              <Detail label="Email">{identity.email && <a href={`mailto:${identity.email}`}>{identity.email}</a>}</Detail>
              <Detail label="Phone">{identity.phone && <span className="data-sm">{identity.phone}</span>}</Detail>
              <Detail label="Form">{sub.forms.title}</Detail>
              <Detail label="Owner">
                <OwnerSelect
                  leadId={lead.id}
                  ownerId={lead.owner_id}
                  team={(team ?? []).map((m: { id: string; email: string; full_name: string | null }) => ({
                    id: m.id,
                    label: m.full_name ? `${m.full_name} (${m.email})` : m.email,
                  }))}
                />
              </Detail>
              <Detail label="Application status">
                <SubmissionStatusBadge status={sub.status || "new"} />
              </Detail>
              <Detail label="Rating">
                <StarRating value={sub.rating} readOnly size={16} />
              </Detail>
              <Detail label="Team notes">{sub.admin_notes}</Detail>
              <Detail label="Lead created">{formatIST(lead.created_at)}</Detail>
              <Detail label="Last updated">{formatIST(lead.updated_at)}</Detail>
            </dl>
            <p className="caption" style={{ color: "var(--ink-subtle)", margin: "var(--space-3) 0 0" }}>
              Rate and add notes on the Submissions page.
            </p>
          </Card>

          <Card title="Effort" subtitle="How much care went into the application.">
            <div className="flex items-center" style={{ gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              <ScoreRing score={insights.effortScore.total} band={insights.effortBand} />
              <div>
                <p className="label" style={{ margin: 0 }}>
                  {EFFORT_BAND_LABEL[insights.effortBand]}
                </p>
                <p className="caption" style={{ color: "var(--ink-muted)", margin: 0 }}>
                  {formatDuration(insights.timeOnForm)} on the form · {insights.totalWords} words
                </p>
              </div>
            </div>
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <BreakdownBar label="Depth" value={insights.effortScore.depth} max={35} />
              <BreakdownBar label="Deliberation" value={insights.effortScore.deliberation} max={25} />
              <BreakdownBar label="Authenticity" value={insights.effortScore.authenticity} max={25} />
              <BreakdownBar label="Completeness" value={insights.effortScore.completeness} max={15} />
            </div>
            <div className="flex flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              {flags.length === 0 ? (
                <Badge dot={false}>No signals</Badge>
              ) : (
                flags.map((f) => (
                  <SignalChip key={f} tone={f === "detailed" || f === "complete" ? "good" : "warn"}>
                    {FLAG_LABEL[f]}
                  </SignalChip>
                ))
              )}
            </div>
          </Card>

          {(source.utm_source || source.utm_medium || source.utm_campaign || source.referrer) && (
            <Card title="Where they came from">
              <dl className="flex flex-col" style={{ gap: "var(--space-3)", margin: 0 }}>
                <Detail label="Source">{source.utm_source}</Detail>
                <Detail label="Medium">{source.utm_medium}</Detail>
                <Detail label="Campaign">{source.utm_campaign}</Detail>
                <Detail label="Referrer">{source.referrer}</Detail>
              </dl>
            </Card>
          )}

          <ProofHubCard leadId={id} tracks={(tracks ?? []) as Track[]} />

          <Card title="Stage history">
            {timeline.length === 0 ? (
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                No moves yet.
              </p>
            ) : (
              <ActivityTimeline items={timeline} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
