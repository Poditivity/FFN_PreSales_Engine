import { Alert, Card, StatCard } from "@/components/ffn";
import { loadAppSettings } from "@/lib/admin/appSettings";
import { FREE_PLAN_LIMITS_GB, formatGb, loadEmailUsage, loadSupabaseUsage, type R2Usage } from "@/lib/admin/usage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppearanceCard } from "./AppearanceCard";
import { DigestCard } from "./DigestCard";
import { EscalationCard } from "./EscalationCard";
import { FormsCard } from "./FormsCard";
import { LoginLog } from "./LoginLog";
import { R2UsageCard } from "./R2UsageCard";
import { UsageMeter } from "./UsageMeter";

const formatCount = (n: number) => n.toLocaleString("en-US");
const formatPercent = (n: number | null) => (n === null ? "No sends yet" : `${n.toFixed(1)}%`);

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).maybeSingle()
    : { data: null };

  const isAdmin = profile?.role === "staff" || profile?.role === "admin";
  const isSuperAdmin = !!profile?.is_super_admin;

  if (!isAdmin) {
    return (
      <div>
        <h1 className="h1">Settings</h1>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Alert tone="danger" title="Admin access required">
            Only staff and admins can open settings.
          </Alert>
        </div>
      </div>
    );
  }

  const [settings, email, supabaseUsage] = await Promise.all([
    loadAppSettings(supabase),
    loadEmailUsage(supabase),
    loadSupabaseUsage(supabase),
  ]);

  // The last Cloudflare reading, so the card has something to show while the
  // fresh one loads. Null until the first successful read.
  const r2Initial: R2Usage | null =
    settings && settings.r2_used_bytes !== null && settings.r2_checked_at
      ? {
          usedBytes: Number(settings.r2_used_bytes),
          objects: Number(settings.r2_object_count ?? 0),
          checkedAt: settings.r2_checked_at,
          truncated: settings.r2_truncated,
          limitGb: FREE_PLAN_LIMITS_GB.r2,
        }
      : null;

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <h1 className="h1">Settings</h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
        Appearance, alerts and summaries, forms, and how much of each service you have used.
      </p>

      <div className="flex flex-col" style={{ marginTop: "var(--space-6)", gap: "var(--space-8)" }}>
        <AppearanceCard />

        <section aria-labelledby="alerts-heading" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <h2 className="h2" id="alerts-heading">
            Alerts and summaries
          </h2>
          {settings ? (
            <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
              <EscalationCard initialMinutes={settings.escalation_minutes} />
              <DigestCard
                initial={{
                  daily_digest_enabled: settings.daily_digest_enabled,
                  daily_digest_time: settings.daily_digest_time,
                  weekly_digest_enabled: settings.weekly_digest_enabled,
                  weekly_digest_day: settings.weekly_digest_day,
                  weekly_digest_time: settings.weekly_digest_time,
                }}
              />
            </div>
          ) : (
            <Alert tone="warning" title="These settings are not available">
              Apply the app_settings migration to set escalation and summaries.
            </Alert>
          )}
        </section>

        <section aria-labelledby="forms-heading" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <h2 className="h2" id="forms-heading">
            Forms
          </h2>
          {settings ? (
            <FormsCard
              initial={{
                privacy_policy_url: settings.privacy_policy_url,
                privacy_policy_text: settings.privacy_policy_text,
              }}
            />
          ) : (
            <Alert tone="warning" title="These settings are not available">
              Apply the app_settings migration to set the privacy notice.
            </Alert>
          )}
        </section>

        <section aria-labelledby="email-heading" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <h2 className="h2" id="email-heading">
            Email
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--space-5)" }}>
            <StatCard
              label="Delivery rate"
              value={formatPercent(email.deliveryPercent)}
              note={`${formatCount(email.sent)} sent, ${formatCount(email.failed)} failed in ${month}.`}
            />
            <StatCard
              label="Emails sent"
              value={formatCount(email.usedThisMonth)}
              note={`In ${month}.`}
            />
          </div>
        </section>

        <section aria-labelledby="usage-heading" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <h2 className="h2" id="usage-heading">
            Storage
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--space-5)" }}>
            <Card title="Supabase" subtitle="Database and file storage for this project.">
              {supabaseUsage ? (
                <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
                  <UsageMeter label="Database" used={supabaseUsage.databaseGb} limit={supabaseUsage.databaseLimitGb} format={formatGb} />
                  <UsageMeter label="File storage" used={supabaseUsage.storageGb} limit={supabaseUsage.storageLimitGb} format={formatGb} />
                </div>
              ) : (
                <Alert tone="warning" title="Usage is not available">
                  Apply the storage_usage migration to read Supabase usage.
                </Alert>
              )}
            </Card>

            <R2UsageCard initial={r2Initial} />
          </div>
        </section>

        {isSuperAdmin && (
          <section aria-labelledby="access-heading" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            <h2 className="h2" id="access-heading">
              Access
            </h2>
            <LoginLog />
          </section>
        )}
      </div>
    </div>
  );
}
