import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NotificationEmails } from "./NotificationEmails";

export default async function NotificationSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: recipients } = await supabase
    .from("notification_emails")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="h1">Submission notifications</h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
        Admins are notified of new submissions unless a super admin has switched notifications off for them on the Team page. Add extra recipients here.
      </p>
      <div style={{ marginTop: "var(--space-6)" }}>
        <NotificationEmails recipients={recipients ?? []} />
      </div>
    </div>
  );
}
