"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// Ported from build-fellowship's app/src/lib/analytics.js — fire-and-forget
// funnel tracking (start / complete / drop) for the public form flow.
//
// getSessionId/resetSessionId live here (not in useFormSubmission) because
// the source system shares a single per-tab session id between the partial
// submission upserts AND these analytics events, so a "form_start" event
// and the form_submissions row it led to always carry the same session_id.

const SESSION_STORAGE_KEY = "ffn_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
  }
  return sid;
}

export function resetSessionId() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function getUtmParams() {
  if (typeof window === "undefined") return { utm_source: null, utm_medium: null, utm_campaign: null };
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source"),
    utm_medium: p.get("utm_medium"),
    utm_campaign: p.get("utm_campaign"),
  };
}

async function fire(event_type: string, extras: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const supabase = createBrowserSupabaseClient();
    await supabase.from("analytics_events").insert({
      session_id: getSessionId(),
      event_type,
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      ...getUtmParams(),
      ...extras,
    });
  } catch {
    // analytics is best-effort — never surface a failure to the user
  }
}

export const trackFormStart = (formId: string, formSlug: string) =>
  fire("form_start", { form_id: formId, form_slug: formSlug });

export const trackFormComplete = (formId: string, formSlug: string, timeSpentSeconds: number) =>
  fire("form_complete", { form_id: formId, form_slug: formSlug, metadata: { time_spent_seconds: timeSpentSeconds } });

export const trackFormDrop = (
  formId: string,
  formSlug: string,
  lastFieldLabel: string | null,
  timeSpentSeconds: number,
) =>
  fire("form_drop", {
    form_id: formId,
    form_slug: formSlug,
    metadata: { last_field_label: lastFieldLabel, time_spent_seconds: timeSpentSeconds },
  });
