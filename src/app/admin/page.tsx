import { firstName, parsePeriod, parseTab } from "@/lib/dashboard/metrics";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Dashboard } from "./_dashboard/Dashboard";

// The admin landing page. Numbers are loaded in the browser from the
// dashboard_* database functions (so the viewer's own time zone shapes the
// daily buckets); the server only resolves who is looking, the period and
// the open tab.
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const { period, tab } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("email, full_name, is_super_admin").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <Dashboard
      period={parsePeriod(period)}
      tab={parseTab(tab)}
      firstName={firstName(profile?.full_name, profile?.email ?? user?.email ?? "")}
      isSuperAdmin={!!profile?.is_super_admin}
    />
  );
}
