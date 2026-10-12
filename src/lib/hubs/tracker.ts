"use client";

import { useCallback, useEffect, useRef } from "react";
import { sendHubEvents, type HubEngagementEvent } from "./publicHub";

const FLUSH_INTERVAL_MS = 8000;
const FLUSH_SIZE = 20;
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Batched engagement tracker — mirrors the source's queue-based tracker.js
 * (verified directly): events queue in memory and flush on whichever of
 * these happens first, rather than one write per interaction: the queue
 * reaching 20 events, an 8s interval, tab hidden/pagehide, or unmount.
 * Preview mode never flushes at all (enforced again, belt-and-suspenders,
 * in sendHubEvents itself).
 */
export function useHubTracker(token: string, sessionId: string, preview: boolean) {
  const queueRef = useRef<HubEngagementEvent[]>([]);

  useEffect(() => {
    const flush = () => {
      if (queueRef.current.length === 0) return;
      const events = queueRef.current;
      queueRef.current = [];
      void sendHubEvents(token, sessionId, events, preview);
    };

    const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [token, sessionId, preview]);

  // Sends whatever is queued right now. The reader calls it after queuing its
  // final reading numbers, because the page may be closing and the next timed
  // flush would never come.
  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return;
    const events = queueRef.current;
    queueRef.current = [];
    void sendHubEvents(token, sessionId, events, preview);
  }, [token, sessionId, preview]);

  // Stable identity (deps are the three primitives it closes over, none of
  // which change across the page's lifetime) so useSectionEngagement's
  // effect below doesn't tear down and rebuild its IntersectionObserver on
  // every render.
  const track = useCallback(
    (type: string, targetType?: string, targetId?: string, meta?: Record<string, unknown>) => {
      queueRef.current.push({ type, target_type: targetType ?? null, target_id: targetId ?? null, meta: meta ?? null });
      if (queueRef.current.length >= FLUSH_SIZE) {
        const events = queueRef.current;
        queueRef.current = [];
        void sendHubEvents(token, sessionId, events, preview);
      }
    },
    [token, sessionId, preview],
  );

  return { track, flush };
}

// Section-level engagement, ported from build-fellowship's Hub.jsx tracking
// effect: an IntersectionObserver with a thin band across the vertical
// center of the viewport (not a ratio threshold, which the source found
// breaks on very tall sections) decides which single section currently
// "has" the visitor's attention. Each section fires section_view once the
// first time it's centered, and a 15s heartbeat timer logs a heartbeat
// event for whichever section is centered right now, but only while the
// tab is actually visible — a backgrounded tab must not accrue dwell time.
export function useSectionEngagement(track: (type: string, targetType?: string, targetId?: string) => void, sectionIds: string[]) {
  useEffect(() => {
    if (sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    let currentSection: string | null = null;
    const seen = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          currentSection = id;
          if (!seen.has(id)) {
            seen.add(id);
            track("section_view", "section", id);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !currentSection) return;
      track("heartbeat", "section", currentSection);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(heartbeat);
    };
  }, [track, sectionIds]);
}
