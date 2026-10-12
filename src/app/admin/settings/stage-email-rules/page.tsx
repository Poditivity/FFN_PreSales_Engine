import { redirect } from "next/navigation";

// Stage rules now live on the Messaging page.
export default function StageEmailRulesRedirect() {
  redirect("/admin/messaging?tab=rules");
}
