import { redirect } from "next/navigation";

// Email templates now live on the Messaging page.
export default function EmailTemplatesRedirect() {
  redirect("/admin/messaging?tab=email");
}
