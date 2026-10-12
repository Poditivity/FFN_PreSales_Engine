import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePublicSettings } from "@/lib/forms/consent";
import { formSchema } from "@/lib/forms/schema";
import { FormRenderer } from "./FormRenderer";

export default async function PublicFormPage({
  params,
}: PageProps<"/forms/[slug]">) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  // RLS (forms_public_select) already restricts this to status = 'active'
  // rows for anon; the explicit .eq is belt-and-suspenders for a clear 404
  // instead of a confusing empty-schema render on a draft/closed form.
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) notFound();

  const form = formSchema.parse(data);

  // The privacy notice and the file limit the team set on Settings. If they
  // cannot be read, the form still works with the standard notice and limit.
  const { data: settingsRow } = await supabase.rpc("public_form_settings");

  return <FormRenderer form={form} settings={normalizePublicSettings(settingsRow)} />;
}
