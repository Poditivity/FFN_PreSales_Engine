// Shapes returned by the dashboard_* Postgres functions
// (supabase/migrations/20260929070738_admin_dashboard_metrics.sql).

export type PeriodId = "7d" | "30d" | "90d" | "all";

export interface Kpis {
  applications: number;
  form_starts: number;
  form_completes: number;
  hubs_sent: number;
  hubs_opened: number;
  new_customers: number;
  stage_moves: number;
}

export interface TrendPoint {
  bucket: string;
  starts: number;
  applications: number;
  hub_opens: number;
}

export interface FormHealth {
  id: string;
  title: string;
  slug: string;
  status: string;
  starts: number;
  completes: number;
  drops: number;
  applications: number;
  median_seconds: number | null;
  top_drop_field: string | null;
}

export interface HubEngagement {
  views: number;
  hubs_viewed: number;
  engaged_seconds: number;
  sections: { section: string; seconds: number }[];
  items: { target_type: string; target_id: string; count: number }[];
  clicks: { type: string; target_id: string; count: number }[];
}

export interface DashboardOverview {
  range: { from: string; to: string; bucket: "day" | "week"; all_time: boolean; tz: string };
  kpis: Kpis;
  kpis_previous: Kpis | null;
  funnel: { stage: string; count: number }[];
  stages_now: Record<string, number>;
  median_days_to_customer: number | null;
  trend: TrendPoint[];
  hub: HubEngagement;
  forms: FormHealth[];
  sources: { source: string; count: number }[];
  campaigns: { campaign: string; count: number }[];
}

export interface Signal<T> {
  count: number;
  items: T[];
}

export interface DashboardAttention {
  unreviewed: Signal<{ submission_id: string; form_id: string; lead_id: string | null; at: string }>;
  no_hub: Signal<{ lead_id: string; stage: string; at: string }>;
  draft_hubs: Signal<{ hub_id: string; lead_id: string | null; applicant_name: string | null; at: string }>;
  warm_hubs: Signal<{
    hub_id: string;
    lead_id: string | null;
    applicant_name: string | null;
    open_count: number;
    at: string;
  }>;
  stuck: Signal<{ lead_id: string; stage: string; at: string }>;
  failed_emails: Signal<{ message_id: string; lead_id: string; subject: string | null; error: string | null; at: string }>;
}

export type AttentionKey = keyof DashboardAttention;

export interface LiveHub {
  hub_id: string;
  lead_id: string | null;
  applicant_name: string | null;
  last_seen: string;
  sessions: number;
  section: string | null;
  engaged_seconds: number;
}

export type ActivityKind = "application" | "stage" | "hub_created" | "hub_opened" | "email_sent" | "email_failed";

export interface ActivityEvent {
  kind: ActivityKind;
  at: string;
  lead_id: string | null;
  hub_id: string | null;
  detail: string | null;
  from_stage: string | null;
  to_stage: string | null;
  extra: string | null;
  actor: string | null;
}
