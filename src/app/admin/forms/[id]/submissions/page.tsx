import { redirect } from "next/navigation";

// Submissions used to be reviewed one form at a time here. They now live in the
// Submissions tab, which covers every form; this keeps old links and bookmarks working.
export default async function FormSubmissionsRedirect({
  params,
  searchParams,
}: PageProps<"/admin/forms/[id]/submissions">) {
  const { id } = await params;
  const { rating } = await searchParams;
  const query = new URLSearchParams({ form: id });
  if (rating === "unrated" || rating === "rated") query.set("rating", rating);
  redirect(`/admin/submissions?${query.toString()}`);
}
