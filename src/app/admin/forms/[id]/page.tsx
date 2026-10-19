import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MANUAL_FORM_SLUG } from "@/lib/forms/manualForm";
import { formSchema } from "@/lib/forms/schema";
import { FormBuilder } from "../FormBuilder";

export default async function EditFormPage({
  params,
}: PageProps<"/admin/forms/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("forms").select("*").eq("id", id).maybeSingle();

  if (error || !data || data.slug === MANUAL_FORM_SLUG) notFound();

  const form = formSchema.parse(data);
  const { count } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);

  return (
    <div>
      <h1 className="h1">Edit form</h1>
      <div style={{ marginTop: "var(--space-6)" }}>
        <FormBuilder initialForm={form} submissionCount={count ?? 0} />
      </div>
    </div>
  );
}
