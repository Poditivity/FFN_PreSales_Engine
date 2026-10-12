import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SubmissionsView, type SubmissionForm } from "./SubmissionsView";

export default async function SubmissionsPage({ searchParams }: PageProps<"/admin/submissions">) {
  const { form, rating } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: forms, error } = await supabase
    .from("forms")
    .select("id, title, schema")
    .order("created_at", { ascending: false })
    .returns<SubmissionForm[]>();

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <SubmissionsView
        forms={forms ?? []}
        initialFormId={typeof form === "string" ? form : ""}
        initialRating={rating === "unrated" || rating === "rated" ? rating : ""}
      />
    </div>
  );
}
