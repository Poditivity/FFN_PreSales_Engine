import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminShell } from "./AdminShell";

// No shell for a signed-out visitor — /admin/login and /admin/set-password
// build their own full-page centered layout and were previously rendered
// underneath the nav bar regardless (a pre-existing oversight this fixes as
// a side effect of needing the current user's profile here anyway).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  const { data: profile } = await supabase.from("profiles").select("email, full_name, is_super_admin").eq("id", user.id).maybeSingle();

  return (
    <AdminShell
      email={profile?.email ?? user.email ?? ""}
      fullName={profile?.full_name ?? null}
      isSuperAdmin={!!profile?.is_super_admin}
    >
      {children}
    </AdminShell>
  );
}
