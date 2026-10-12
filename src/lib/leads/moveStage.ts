import { dispatchPendingLeadEmail } from "@/lib/emailEngine/thread";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { LeadStage } from "./schema";

/**
 * Moves a lead to any stage, in any order. Shared by the leads board and the
 * lead's own page so the two can never behave differently.
 *
 * The lead_stage_history row is written by the log_lead_stage_change trigger,
 * and dispatch_stage_email_rule inserts a pending email row when an enabled
 * rule exists for the new stage. Dispatching that email is best-effort: a
 * failure never undoes the move, and the pending row stays visible in the
 * lead's thread either way.
 */
export async function moveLeadToStage(leadId: string, stage: LeadStage): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
  if (error) return { error: error.message };
  dispatchPendingLeadEmail(leadId).catch(() => {});
  return { error: null };
}

const DISPATCH_CONCURRENCY = 4;

/**
 * Moves many leads to one stage in a single write, then dispatches any
 * stage-rule emails a few at a time so a large selection does not open
 * hundreds of requests at once. The update is all or nothing; dispatching is
 * best-effort exactly as for a single move.
 */
export async function moveLeadsToStage(leadIds: string[], stage: LeadStage): Promise<{ error: string | null }> {
  if (leadIds.length === 0) return { error: null };
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("leads").update({ stage }).in("id", leadIds);
  if (error) return { error: error.message };

  const queue = [...leadIds];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await dispatchPendingLeadEmail(id).catch(() => {});
    }
  };
  // Not awaited: the move has already succeeded and the admin should not wait on email delivery.
  Promise.all(Array.from({ length: Math.min(DISPATCH_CONCURRENCY, queue.length) }, worker)).catch(() => {});
  return { error: null };
}
