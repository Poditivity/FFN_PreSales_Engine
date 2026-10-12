import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { utcToIST } from "@/lib/forms/ist";
import type { LeadStage } from "./schema";

/**
 * The call log. Every call the team makes to a lead is one lead_calls row that
 * carries the stage the lead was in when the call was made, so the counts per
 * stage stay the same after the lead moves on.
 */

export type CallOutcome = "connected" | "no_answer" | "voicemail" | "busy" | "wrong_number" | "call_back_later";

export const CALL_OUTCOMES: { id: CallOutcome; label: string; tone: "success" | "neutral" | "warning" | "danger" }[] = [
  { id: "connected", label: "Connected", tone: "success" },
  { id: "no_answer", label: "No answer", tone: "neutral" },
  { id: "voicemail", label: "Voicemail", tone: "neutral" },
  { id: "busy", label: "Busy", tone: "warning" },
  { id: "call_back_later", label: "Call back later", tone: "warning" },
  { id: "wrong_number", label: "Wrong number", tone: "danger" },
];

export function outcomeLabel(outcome: string): string {
  return CALL_OUTCOMES.find((o) => o.id === outcome)?.label ?? outcome;
}

export interface LeadCall {
  id: string;
  lead_id: string;
  stage: LeadStage;
  outcome: CallOutcome;
  called_at: string;
  notes: string | null;
  follow_up_on: string | null;
  called_by: string | null;
  /** Who logged it, joined for display. */
  profiles?: { email: string; full_name: string | null } | null;
}

export interface CallDraft {
  stage: LeadStage;
  outcome: CallOutcome;
  calledAt: string;
  notes: string;
  followUpOn: string | null;
}

export const CALL_SELECT = "id, lead_id, stage, outcome, called_at, notes, follow_up_on, called_by, profiles(email, full_name)";

export function callerName(call: Pick<LeadCall, "profiles">): string {
  return call.profiles?.full_name || call.profiles?.email || "Someone on the team";
}

// ---- Date helpers ---------------------------------------------------------
// The team works in IST, and a call is logged with the time it happened, so the
// form's date and time are IST wall-clock values converted here.

/** Today's date and the current time in IST, as the form's default. Call from an effect or handler, not during render. */
export function nowInIST(): { date: string; time: string } {
  return utcToIST(new Date().toISOString());
}

/** IST date ("YYYY-MM-DD") and time ("HH:MM") to a UTC ISO timestamp. */
export function istToIso(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}:00+05:30`).toISOString();
}

// ---- Summaries ------------------------------------------------------------

export interface CallSummary {
  total: number;
  connected: number;
  byStage: Partial<Record<LeadStage, number>>;
  lastCalledAt: string | null;
  nextFollowUpOn: string | null;
}

export function summarizeCalls(calls: Pick<LeadCall, "stage" | "outcome" | "called_at" | "follow_up_on">[]): CallSummary {
  const summary: CallSummary = { total: 0, connected: 0, byStage: {}, lastCalledAt: null, nextFollowUpOn: null };
  for (const call of calls) {
    summary.total += 1;
    if (call.outcome === "connected") summary.connected += 1;
    summary.byStage[call.stage] = (summary.byStage[call.stage] ?? 0) + 1;
    if (!summary.lastCalledAt || call.called_at > summary.lastCalledAt) summary.lastCalledAt = call.called_at;
    if (call.follow_up_on && (!summary.nextFollowUpOn || call.follow_up_on > summary.nextFollowUpOn)) {
      summary.nextFollowUpOn = call.follow_up_on;
    }
  }
  return summary;
}

/** "3 calls: 2 at MQL, 1 at SQL". Stages are listed in the order given so the wording follows the pipeline. */
export function describeCalls(
  byStage: Partial<Record<LeadStage, number>>,
  stages: { id: LeadStage; label: string }[],
): string {
  const parts = stages.filter((s) => byStage[s.id]).map((s) => `${byStage[s.id]} at ${s.label}`);
  return parts.join(", ");
}

export function callsWord(count: number): string {
  return count === 1 ? "1 call" : `${count} calls`;
}

// ---- Reads and writes -----------------------------------------------------

export async function saveCall(
  leadId: string,
  draft: CallDraft,
  existingId?: string,
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient();
  const row = {
    stage: draft.stage,
    outcome: draft.outcome,
    called_at: draft.calledAt,
    notes: draft.notes.trim() || null,
    follow_up_on: draft.followUpOn || null,
  };
  if (existingId) {
    const { error } = await supabase.from("lead_calls").update(row).eq("id", existingId);
    return { error: error?.message ?? null };
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You are signed out. Sign in again to log the call." };
  const { error } = await supabase.from("lead_calls").insert({ ...row, lead_id: leadId, called_by: auth.user.id });
  return { error: error?.message ?? null };
}

export async function deleteCall(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("lead_calls").delete().eq("id", id);
  return { error: error?.message ?? null };
}
