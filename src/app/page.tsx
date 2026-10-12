import { redirect } from "next/navigation";

// There is no public home page. Signed-in staff land on the admin dashboard,
// and the proxy sends anyone without a session on to the sign-in page.
export default function Home() {
  redirect("/admin");
}
