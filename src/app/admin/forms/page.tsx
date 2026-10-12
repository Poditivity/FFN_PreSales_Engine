import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge, Button, EmptyState } from "@/components/ffn";
import { FormDeleteButton } from "./FormDeleteButton";
import { FormLinkActions } from "./FormLinkActions";

const STATUS_TONE = {
  draft: "neutral",
  active: "success",
  closed: "warning",
} as const;

export default async function AdminFormsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: forms, error } = await supabase
    .from("forms")
    .select("id, title, slug, status, created_at")
    .order("created_at", { ascending: false });

  // A form with submissions cannot be deleted, so the list needs each count.
  const counts = new Map<string, number>(
    await Promise.all(
      (forms ?? []).map(async (f) => {
        const { count } = await supabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true })
          .eq("form_id", f.id);
        return [f.id, count ?? 0] as const;
      }),
    ),
  );

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "var(--space-3)" }}>
        <h1 className="h1">Forms</h1>
        <Link href="/admin/forms/new">
          <Button>New form</Button>
        </Link>
      </div>

      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginTop: "var(--space-4)" }}>
          {error.message}
        </p>
      )}

      {forms?.length === 0 ? (
        <div style={{ marginTop: "var(--space-8)" }}>
          <EmptyState title="No forms yet">
            Create a form to start collecting applications.
          </EmptyState>
        </div>
      ) : (
        <ul
          style={{
            marginTop: "var(--space-6)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface)",
          }}
        >
          {forms?.map((form, i) => (
            <li
              key={form.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
                <p className="body-medium">{form.title}</p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  /forms/{form.slug}
                </p>
              </div>
              <div className="flex flex-wrap items-center" style={{ gap: "var(--space-4)" }}>
                <Badge tone={STATUS_TONE[form.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                  {form.status}
                </Badge>
                <FormLinkActions id={form.id} slug={form.slug} active={form.status === "active"} />
                <Link href={`/admin/forms/${form.id}`} className="body-sm">
                  Edit
                </Link>
                <Link href={`/admin/submissions?form=${form.id}`} className="body-sm">
                  Submissions
                </Link>
                <FormDeleteButton id={form.id} title={form.title} submissionCount={counts.get(form.id) ?? 0} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
