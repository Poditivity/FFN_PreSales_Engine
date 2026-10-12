"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getSessionId, resetSessionId } from "./analytics";
import type { FieldTiming } from "./insights";

// Ported from build-fellowship's app/src/components/forms/SessionTracker.jsx
// (useSessionTracker), rebuilt against TanStack Query instead of plain
// useState/useEffect, and fixing the source's unreliable beforeunload flush
// (see flushOnUnload below). getSessionId/resetSessionId live in ./analytics
// because the source shares one session id between submissions and events.

interface UpsertPayload {
  data: Record<string, unknown>;
  field_timings: Record<string, FieldTiming>;
  keystroke_counts: Record<string, number>;
  time_on_form_seconds: number;
  partial: boolean;
  completed: boolean;
}

export function useFormSubmission(formId: string | null) {
  // Lazy useState (not useRef) for values read during render — reading
  // ref.current at render time is unsafe (flagged by react-hooks/refs) and
  // both of these are set exactly once and never mutated afterwards.
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [sessionId] = useState(() => getSessionId());

  const startedAt = useRef<number | null>(null);
  const timings = useRef<Record<string, FieldTiming>>({});
  const keystrokes = useRef<Record<string, number>>({});
  const dataRef = useRef<Record<string, unknown>>({});
  const completedRef = useRef(false);

  const ensureStarted = useCallback(() => {
    if (!startedAt.current) startedAt.current = Date.now();
  }, []);

  const onFieldFocus = useCallback(
    (fieldId: string) => {
      ensureStarted();
      timings.current[fieldId] = {
        ...(timings.current[fieldId] ?? {}),
        focused_at: Date.now(),
      };
    },
    [ensureStarted],
  );

  const onFieldBlur = useCallback((fieldId: string) => {
    const t = timings.current[fieldId];
    if (t?.focused_at) {
      const blurred = Date.now();
      timings.current[fieldId] = {
        focused_at: t.focused_at,
        blurred_at: blurred,
        duration_ms: (t.duration_ms ?? 0) + (blurred - t.focused_at),
      };
    }
  }, []);

  const onKeystroke = useCallback((fieldId: string) => {
    keystrokes.current[fieldId] = (keystrokes.current[fieldId] ?? 0) + 1;
  }, []);

  const setData = useCallback((values: Record<string, unknown>) => {
    dataRef.current = values;
  }, []);

  const timeOnFormSeconds = useCallback(
    () => (startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0),
    [],
  );

  const buildPayload = useCallback(
    (partial: boolean, completed: boolean): UpsertPayload => ({
      data: dataRef.current,
      field_timings: timings.current,
      keystroke_counts: keystrokes.current,
      time_on_form_seconds: timeOnFormSeconds(),
      partial,
      completed,
    }),
    [timeOnFormSeconds],
  );

  const upsert = useCallback(
    async (payload: UpsertPayload): Promise<string | null> => {
      if (!formId) return null;
      const { data, error } = await supabase.rpc("upsert_form_submission", {
        p_session_id: sessionId,
        p_form_id: formId,
        p_data: payload.data,
        p_field_timings: payload.field_timings,
        p_keystroke_counts: payload.keystroke_counts,
        p_time_on_form_seconds: payload.time_on_form_seconds,
        p_partial: payload.partial,
        p_completed: payload.completed,
      });
      if (error) throw error;
      return data as string | null;
    },
    [formId, supabase, sessionId],
  );

  // Partial autosave: best-effort, errors swallowed.
  const partialSaveMutation = useMutation({ mutationFn: upsert });

  // Final submit: TanStack Query's built-in retry replaces the source's
  // hand-rolled 3x/500ms-backoff loop. A failed final flush rejects and
  // must surface to the caller — never silently show a success screen.
  const finalSubmitMutation = useMutation({
    mutationFn: upsert,
    retry: 3,
    retryDelay: (attemptIndex) => 500 * (attemptIndex + 1),
  });

  const flush = useCallback(
    (opts: { partial?: boolean; completed?: boolean } = {}): Promise<string | null> => {
      if (!formId || !startedAt.current) return Promise.resolve(null);
      const { partial = true, completed = false } = opts;
      const payload = buildPayload(partial, completed);
      if (completed) {
        return finalSubmitMutation.mutateAsync(payload).then((id) => {
          resetSessionId();
          return id;
        });
      }
      return partialSaveMutation.mutateAsync(payload).catch(() => null);
    },
    [formId, buildPayload, finalSubmitMutation, partialSaveMutation],
  );

  const markCompleted = useCallback(() => {
    completedRef.current = true;
  }, []);

  // Reliable unload flush — fixes the source system's bug where the final
  // beforeunload autosave could get killed mid-request. A normal awaited
  // fetch/supabase-js call is not guaranteed to complete once the browser
  // starts tearing the page down. `fetch(..., { keepalive: true })` is the
  // platform-supported escape hatch: the browser queues the request and
  // completes it even after the page is gone. This bypasses supabase-js
  // (whose underlying fetch doesn't set keepalive) and posts directly to
  // the PostgREST RPC endpoint.
  const flushOnUnload = useCallback(() => {
    if (!formId || !startedAt.current || completedRef.current) return;
    const payload = buildPayload(true, false);
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/upsert_form_submission`;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    try {
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          p_session_id: sessionId,
          p_form_id: formId,
          p_data: payload.data,
          p_field_timings: payload.field_timings,
          p_keystroke_counts: payload.keystroke_counts,
          p_time_on_form_seconds: payload.time_on_form_seconds,
          p_partial: payload.partial,
          p_completed: payload.completed,
        }),
      }).catch(() => {});
    } catch {
      // best-effort — never block unload
    }
  }, [formId, buildPayload, sessionId]);

  useEffect(() => {
    if (!formId) return;
    const interval = setInterval(() => {
      if (startedAt.current && !completedRef.current) {
        flush({ partial: true, completed: false });
      }
    }, 30000);

    // pagehide fires more reliably than beforeunload on mobile Safari and
    // on tab close; both are wired to the same keepalive flush.
    window.addEventListener("beforeunload", flushOnUnload);
    window.addEventListener("pagehide", flushOnUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", flushOnUnload);
      window.removeEventListener("pagehide", flushOnUnload);
    };
  }, [formId, flush, flushOnUnload]);

  return {
    sessionId,
    onFieldFocus,
    onFieldBlur,
    onKeystroke,
    setData,
    flush,
    markCompleted,
    timeOnFormSeconds,
    isSubmitting: finalSubmitMutation.isPending,
    submitError: finalSubmitMutation.error,
  };
}
