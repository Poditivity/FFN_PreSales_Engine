"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, Link2, Plus, Search, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Tabs } from "@/components/ffn";
import { attentionQueue, buildSummary, dashboardHref, greeting, PERIODS, type DashboardTab } from "@/lib/dashboard/metrics";
import {
  fetchActivity,
  fetchAttention,
  fetchContentNames,
  fetchLeadNames,
  fetchLive,
  fetchOverview,
  type LeadName,
} from "@/lib/dashboard/queries";
import type { PeriodId } from "@/lib/dashboard/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActivityCard } from "./Activity";
import { CallsCard } from "./CallsCard";
import { AttentionPanel } from "./Attention";
import { openCommandPalette } from "./CommandPalette";
import { FormHealthCard } from "./FormHealth";
import { HubEngagementCard } from "./HubEngagement";
import { KpiRow } from "./Kpis";
import { LivePanel } from "./Live";
import { PipelineCard } from "./Pipeline";
import { SourcesCard } from "./Sources";
import { TrendCard } from "./Trend";
import { LinkButton, SectionError, Skeleton, useIsMac, useNow } from "./ui";

const EMPTY_NAMES = new Map<string, LeadName>();
const EMPTY_CONTENT = new Map<string, string>();

export function Dashboard({
  period,
  tab,
  firstName,
  isSuperAdmin,
}: {
  period: PeriodId;
  tab: DashboardTab;
  firstName: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const isMac = useIsMac();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  // Refresh cadence follows how fast each signal changes: live readers every
  // 30s, the to-do list and feed every minute, the period numbers every 5
  // minutes. Previous data stays on screen while a new period loads, and
  // nothing animates when it is replaced.
  const overview = useQuery({
    queryKey: ["dashboard", "overview", period, tz],
    queryFn: () => fetchOverview(supabase, period, new Date(), tz),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const attention = useQuery({
    queryKey: ["dashboard", "attention"],
    queryFn: () => fetchAttention(supabase),
    refetchInterval: 60_000,
  });
  const live = useQuery({
    queryKey: ["dashboard", "live"],
    queryFn: () => fetchLive(supabase),
    refetchInterval: 30_000,
  });
  const activity = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => fetchActivity(supabase, 30),
    refetchInterval: 60_000,
  });

  const leadIds = useMemo(() => {
    const ids = new Set<string>();
    const add = (id: string | null | undefined) => id && ids.add(id);
    if (attention.data) {
      for (const signal of Object.values(attention.data)) for (const item of signal.items) add(item.lead_id);
    }
    live.data?.forEach((h) => add(h.lead_id));
    activity.data?.forEach((e) => add(e.lead_id));
    return [...ids].sort();
  }, [attention.data, live.data, activity.data]);

  const names = useQuery({
    queryKey: ["dashboard", "lead-names", leadIds.join(",")],
    queryFn: () => fetchLeadNames(supabase, leadIds),
    enabled: leadIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const contentItems = overview.data?.hub.items;
  const contentNames = useQuery({
    queryKey: ["dashboard", "content-names", (contentItems ?? []).map((i) => `${i.target_type}:${i.target_id}`).join(",")],
    queryFn: () => fetchContentNames(supabase, contentItems ?? []),
    enabled: (contentItems?.length ?? 0) > 0,
    staleTime: 5 * 60_000,
  });

  const nameMap = names.data ?? EMPTY_NAMES;
  const summary = buildSummary({
    kpis: overview.data?.kpis,
    period,
    attention: attention.data,
    liveCount: live.data?.length ?? 0,
  });

  const attentionCount = attentionQueue(attention.data).length;

  function go(next: { period?: PeriodId; tab?: DashboardTab }) {
    router.replace(dashboardHref(next.period ?? period, next.tab ?? tab), { scroll: false });
  }

  // Desktop keeps them small on the tab row. Phones and tablets get the medium
  // size, which is easier to tap, and each button fills its grid cell on phones.
  const quickActions = (size: "sm" | "md", className?: string) => (
    <>
      <LinkButton href="/admin/hubs?new=1" size={size} variant="primary" className={className} iconLeft={<Link2 size={15} strokeWidth={1.75} />}>
        New hub
      </LinkButton>
      <LinkButton href="/admin/forms/new" size={size} className={className} iconLeft={<Plus size={15} strokeWidth={1.75} />}>
        New form
      </LinkButton>
      <LinkButton href="/admin/leads" size={size} className={className} iconLeft={<Users size={15} strokeWidth={1.75} />}>
        Leads board
      </LinkButton>
      <LinkButton href="/admin/submissions" size={size} className={className} iconLeft={<FileText size={15} strokeWidth={1.75} />}>
        Applications
      </LinkButton>
      {isSuperAdmin && (
        <LinkButton href="/admin/team" size={size} className={className} iconLeft={<UserPlus size={15} strokeWidth={1.75} />}>
          Invite
        </LinkButton>
      )}
    </>
  );

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }} data-testid="dashboard">
      <header className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "var(--space-4)" }}>
        <div className="ffn-grow">
          <h1 className="h1" style={{ margin: 0 }}>
            {now ? greeting(now.getHours()) : "Welcome back"}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="body" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0", maxWidth: "var(--prose-max)" }}>
            {overview.isPending || attention.isPending ? <Skeleton height="var(--space-5)" width="70%" /> : summary}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <div className="dash-segment" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="dash-segment__btn label-sm"
                aria-pressed={p.id === period}
                onClick={() => go({ period: p.id })}
                aria-label={p.label}
              >
                <span className="sm:hidden" aria-hidden>
                  {p.days ? `${p.days}d` : "All"}
                </span>
                <span className="hidden sm:inline" aria-hidden>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ffn-btn ffn-btn--secondary ffn-btn--md"
            onClick={openCommandPalette}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search size={16} strokeWidth={1.75} aria-hidden />
            <span className="sr-only sm:not-sr-only">Search</span>
            <kbd className="dash-kbd data-sm hidden sm:inline-flex">{isMac ? "\u2318 K" : "Ctrl K"}</kbd>
          </button>
        </div>
      </header>

      {/* Quick actions sit on the tab row itself on desktop. Below that they get
          their own block, all in view: a two column grid on phones, a wrapping
          row on tablets. Nothing scrolls sideways or hides. */}
      <nav
        aria-label="Quick actions"
        className="dash-actions grid grid-cols-2 sm:flex sm:flex-wrap lg:hidden"
        style={{ gap: "var(--space-2)" }}
      >
        {quickActions("md", "w-full sm:w-auto")}
      </nav>

      <div className="dash-tabbar">
        <Tabs
          active={tab}
          onChange={(id) => go({ tab: id as DashboardTab })}
          items={[
            { id: "overview", label: "Dashboard" },
            {
              id: "attention",
              label: (
                <>
                  <span className="hidden sm:inline">Needs your attention</span>
                  <span className="sm:hidden">Attention</span>
                </>
              ),
              count: attention.data ? attentionCount : undefined,
            },
            {
              id: "activity",
              label: (
                <>
                  <span className="hidden sm:inline">Recent activity</span>
                  <span className="sm:hidden">Activity</span>
                </>
              ),
            },
          ]}
        />
        <nav aria-label="Quick actions" className="hidden lg:flex items-center" style={{ gap: "var(--space-2)", paddingBottom: "var(--space-2)" }}>
          {quickActions("sm")}
        </nav>
      </div>

      {tab === "overview" && (
        <div role="tabpanel" aria-label="Dashboard" className="flex flex-col" style={{ gap: "var(--space-6)" }}>
          {overview.error ? (
            <SectionError message={overview.error.message} />
          ) : (
            <>
              <KpiRow overview={overview.data} period={period} />

              <section className="grid grid-cols-1 xl:grid-cols-5" style={{ gap: "var(--space-6)" }}>
                <div className="xl:col-span-2" style={{ minWidth: 0 }}>
                  <PipelineCard overview={overview.data} period={period} />
                </div>
                <div className="xl:col-span-3" style={{ minWidth: 0 }}>
                  <TrendCard overview={overview.data} period={period} />
                </div>
              </section>

              <CallsCard />

              <HubEngagementCard overview={overview.data} period={period} contentNames={contentNames.data ?? EMPTY_CONTENT} />

              <section className="grid grid-cols-1 xl:grid-cols-3" style={{ gap: "var(--space-6)" }}>
                <div className="xl:col-span-2" style={{ minWidth: 0 }}>
                  <FormHealthCard overview={overview.data} period={period} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <SourcesCard overview={overview.data} period={period} />
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {tab === "attention" && (
        <section role="tabpanel" aria-label="Needs your attention" className="grid grid-cols-1 xl:grid-cols-3" style={{ gap: "var(--space-6)" }}>
          <div className="xl:col-span-2" style={{ minWidth: 0 }}>
            <AttentionPanel attention={attention.data} names={nameMap} now={now} error={attention.error} />
          </div>
          <div style={{ minWidth: 0 }}>
            <LivePanel live={live.data} names={nameMap} now={now} updatedAt={live.dataUpdatedAt} error={live.error} />
          </div>
        </section>
      )}

      {tab === "activity" && (
        <div role="tabpanel" aria-label="Recent activity">
          <ActivityCard activity={activity.data} names={nameMap} now={now} error={activity.error} />
        </div>
      )}
    </div>
  );
}
