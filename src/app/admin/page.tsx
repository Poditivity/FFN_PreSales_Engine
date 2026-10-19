import { firstName, parseForms, parsePeriod, parseTab } from "@/lib/dashboard/metrics";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Dashboard } from "./_dashboard/Dashboard";

// The admin landing page. Numbers are loaded in the browser from the
// dashboard_* database functions (so the viewer's own time zone shapes the
// daily buckets); the server only resolves who is looking, the period and
// the open tab.
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const { period, tab, forms: formsParam } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("email, full_name, is_super_admin").eq("id", user.id).maybeSingle()
    : { data: null };

  // Every form, for the filter. An unreadable list just hides the filter.
  const { data: formRows } = await supabase.from("forms").select("id, title").order("title");
  const forms = (formRows ?? []) as { id: string; title: string }[];
  // Only forms that exist count, so a stale link cannot filter the numbers to nothing.
  const known = new Set(forms.map((f) => f.id));

  return (
    <Dashboard
      period={parsePeriod(period)}
      tab={parseTab(tab)}
      formIds={parseForms(formsParam).filter((id) => known.has(id))}
      forms={forms}
      firstName={firstName(profile?.full_name, profile?.email ?? user?.email ?? "")}
      isSuperAdmin={!!profile?.is_super_admin}
    />
  );
}
