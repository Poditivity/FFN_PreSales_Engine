import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ffn";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Founder } from "@/lib/content/types";
import { CoFounderLinks } from "./CoFounderLinks";

export default async function FounderDetailPage({ params }: PageProps<"/admin/content/founders/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: founder, error } = await supabase.from("founders").select("*").eq("id", id).maybeSingle();
  if (error || !founder) notFound();

  // Fetched in two steps rather than an embedded select — see the comment on
  // listCoFounders in src/lib/content/founders.ts for why.
  const [{ data: coFounderLinks }, { data: allFounders }] = await Promise.all([
    supabase.from("founder_co_founder_links").select("co_founder_id").eq("founder_id", id),
    supabase.from("founders").select("id, name, startup_name").neq("id", id).order("name", { ascending: true }),
  ]);

  const typedFounder = founder as Founder;
  const coFounderIds = (coFounderLinks ?? []).map((l) => l.co_founder_id);
  const { data: coFounderRows } =
    coFounderIds.length > 0
      ? await supabase.from("founders").select("id, name, startup_name, photo_url").in("id", coFounderIds)
      : { data: [] as { id: string; name: string; startup_name: string | null; photo_url: string | null }[] };
  const coFounders = coFounderRows ?? [];

  return (
    <div>
      <div className="flex items-center" style={{ gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <Link href="/admin/content/founders">
          <Button variant="secondary" size="sm" aria-label="Back to founders">
            <ArrowLeft size={15} />
          </Button>
        </Link>
        <h1 className="h1">{typedFounder.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--space-4)" }}>
        <Card title="Startup">
          <dl className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <div>
              <dt className="body-sm" style={{ color: "var(--ink-muted)" }}>Startup name</dt>
              <dd className="body">{typedFounder.startup_name || "—"}</dd>
            </div>
            <div>
              <dt className="body-sm" style={{ color: "var(--ink-muted)" }}>Current stage</dt>
              <dd className="body">{typedFounder.current_stage || "—"}</dd>
            </div>
            <div>
              <dt className="body-sm" style={{ color: "var(--ink-muted)" }}>Industry</dt>
              <dd className="body">{typedFounder.industry || "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Co-founders" subtitle="A startup can have more than one founder — link them here.">
          <CoFounderLinks founderId={id} coFounders={coFounders} allFounders={allFounders ?? []} />
        </Card>
      </div>
    </div>
  );
}
