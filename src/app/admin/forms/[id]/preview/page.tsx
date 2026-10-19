import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePublicSettings } from "@/lib/forms/consent";
import { MANUAL_FORM_SLUG } from "@/lib/forms/manualForm";
import { formSchema } from "@/lib/forms/schema";
import { Alert } from "@/components/ffn";
import { FormRenderer } from "@/app/forms/[slug]/FormRenderer";

// The form as an applicant sees it, for any status. The renderer runs in
// preview mode, so nothing typed here is saved, counted or emailed: it never
// reaches the real submissions.
export default async function PreviewFormPage({
  params,
}: PageProps<"/admin/forms/[id]/preview">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("forms").select("*").eq("id", id).maybeSingle();

  if (error || !data || data.slug === MANUAL_FORM_SLUG) notFound();

  const form = formSchema.parse(data);
  const { data: settingsRow } = await supabase.rpc("public_form_settings");

  return (
    <div>
      <Alert tone="warning" title="Preview only">
        Nothing you enter here is saved or sent. It does not appear in submissions.
      </Alert>
      <div style={{ marginTop: "var(--space-6)" }}>
        <FormRenderer form={form} settings={normalizePublicSettings(settingsRow)} preview />
      </div>
    </div>
  );
}
