import type { SupabaseClient } from "@supabase/supabase-js";
import { MANUAL_FORM_SLUG } from "./manualForm";
import { EMPTY_SOURCE, type SubmissionRow, type SubmissionSource } from "./submissionAnalysis";
import type { FormSubmissionRow } from "./schema";

// Any Supabase client works: the browser one for the lists, the server one for a single lead's page.
type Supabase = SupabaseClient;

// PostgREST caps a single response at its max-rows setting, so this is an
// upper bound rather than a promise. `total` from the count says whether the
// view is truncated and the page tells the reviewer so.
export const FETCH_LIMIT = 1000;

// Session ids ride in the query string, so they go in small batches.
const SOURCE_BATCH = 50;

type SubmissionQueryRow = FormSubmissionRow & { forms: { title: string; slug: string } | null };

interface EventRow extends SubmissionSource {
  session_id: string;
}

/**
 * form_submissions has no UTM or referrer columns: the public form records
 * them on its analytics events, keyed by the same session id as the
 * submission. The first event of a session is the landing, so its referrer and
 * user agent win, and the first UTM value seen for each key wins.
 */
export async function loadSources(supabase: Supabase, sessionIds: string[]): Promise<Map<string, SubmissionSource>> {
  const sources = new Map<string, SubmissionSource>();
  const batches: string[][] = [];
  for (let i = 0; i < sessionIds.length; i += SOURCE_BATCH) batches.push(sessionIds.slice(i, i + SOURCE_BATCH));

  const results = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("analytics_events")
        .select("session_id, referrer, user_agent, utm_source, utm_medium, utm_campaign")
        .in("session_id", batch)
        .order("created_at", { ascending: true })
        .returns<EventRow[]>(),
    ),
  );

  for (const { data, error } of results) {
    // Source is context, not content: a failure here must not hide the submissions.
    if (error || !data) continue;
    for (const event of data) {
      const current = sources.get(event.session_id) ?? { ...EMPTY_SOURCE };
      sources.set(event.session_id, {
        utm_source: current.utm_source ?? event.utm_source,
        utm_medium: current.utm_medium ?? event.utm_medium,
        utm_campaign: current.utm_campaign ?? event.utm_campaign,
        referrer: current.referrer ?? event.referrer,
        user_agent: current.user_agent ?? event.user_agent,
      });
    }
  }
  return sources;
}

export async function loadSubmissions(
  supabase: Supabase,
  { formId, status, limit = FETCH_LIMIT }: { formId: string | null; status: string | null; limit?: number },
): Promise<{ rows: SubmissionRow[]; total: number }> {
  let query = supabase
    .from("form_submissions")
    .select("*, forms!inner(title, slug)", { count: "exact" })
    .eq("completed", true)
    .order("created_at", { ascending: false })
    .range(0, limit - 1);
  if (formId) query = query.eq("form_id", formId);
  // Leads the team added by hand are not applications, so they are not reviewed here.
  query = query.neq("forms.slug", MANUAL_FORM_SLUG);
  // A new application has no status stored, and the screens show that as "New", so
  // the New filter has to match an empty status as well as an explicit "new".
  if (status === "new") query = query.or("status.is.null,status.eq.new");
  else if (status) query = query.eq("status", status);

  const { data, error, count } = await query.returns<SubmissionQueryRow[]>();
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const sources = await loadSources(
    supabase,
    rows.map((r) => r.session_id),
  );
  return {
    rows: rows.map((r) => ({ ...r, source: sources.get(r.session_id) ?? EMPTY_SOURCE })),
    total: count ?? 0,
  };
}

export async function updateSubmission(
  supabase: Supabase,
  id: string,
  patch: Partial<Pick<FormSubmissionRow, "rating" | "status" | "admin_notes">>,
) {
  const { error } = await supabase.from("form_submissions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function resendConfirmationEmail(supabase: Supabase, submissionId: string) {
  const { data, error } = await supabase.functions.invoke("send-submission-email", {
    body: { submissionId, mode: "resend_confirmation" },
  });
  if (error || !data?.submitterEmailSent) {
    throw new Error(data?.errors?.join("; ") || "No participant email found.");
  }
}
