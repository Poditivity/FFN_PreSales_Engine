import { redirect } from "next/navigation";
import { Card } from "@/components/ffn";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PasswordSection } from "./PasswordSection";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, phone, role, is_super_admin")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <h1 className="h1">My profile</h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
        Your account details and password.
      </p>
      <div
        className="grid grid-cols-1 lg:grid-cols-2 items-start"
        style={{ marginTop: "var(--space-6)", gap: "var(--space-5)", maxWidth: 960 }}
      >
        <Card title="Details">
          <ProfileForm
            email={profile!.email}
            fullName={profile!.full_name}
            phone={profile!.phone}
            role={profile!.role}
            isSuperAdmin={profile!.is_super_admin}
          />
        </Card>
        <PasswordSection email={profile!.email} />
      </div>
    </div>
  );
}
