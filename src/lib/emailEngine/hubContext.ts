import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export interface HubViewedItem {
  target_type: string;
  target_id: string;
  count: number;
}

export interface HubEngagementSummary {
  hub_id: string;
  token: string;
  status: "draft" | "sent" | "opened";
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  viewed_items: HubViewedItem[];
}

/**
 * Read-only context for a lead's compose view: was their hub opened, and
 * what did they look at. Never a trigger — a hub being opened doesn't fire
 * anything on its own, it's just something for staff to see before writing
 * a manual follow-up (see the phase-5 spec: "then have a call" is a
 * real-world step nothing here can detect).
 */
export async function getHubEngagementSummary(leadId: string): Promise<HubEngagementSummary[]> {
  const supabase = createBrowserSupabaseClient();
  const { data: hubs, error: hubsError } = await supabase
    .from("hubs")
    .select("id, token, status, open_count, first_opened_at, last_opened_at")
    .eq("lead_id", leadId);
  if (hubsError) throw hubsError;
  if (!hubs || hubs.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("hub_events")
    .select("hub_id, type, target_type, target_id")
    .in(
      "hub_id",
      hubs.map((h) => h.id),
    )
    .eq("type", "view");
  if (eventsError) throw eventsError;

  return hubs.map((hub) => {
    const counts = new Map<string, HubViewedItem>();
    for (const event of events ?? []) {
      if (event.hub_id !== hub.id || !event.target_type || !event.target_id) continue;
      const key = `${event.target_type}:${event.target_id}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { target_type: event.target_type, target_id: event.target_id, count: 1 });
    }
    return {
      hub_id: hub.id,
      token: hub.token,
      status: hub.status,
      open_count: hub.open_count,
      first_opened_at: hub.first_opened_at,
      last_opened_at: hub.last_opened_at,
      viewed_items: [...counts.values()],
    };
  });
}
