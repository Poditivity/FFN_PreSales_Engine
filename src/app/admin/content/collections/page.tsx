import type { Collection, CollectionItem, Track } from "@/lib/content/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CollectionsManager } from "./CollectionsManager";

export default async function CollectionsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: collections, error }, { data: items }, { data: tracks }] = await Promise.all([
    supabase.from("content_collections").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase
      .from("content_collection_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <CollectionsManager
        initialCollections={(collections ?? []) as Collection[]}
        initialItems={(items ?? []) as CollectionItem[]}
        tracks={(tracks ?? []) as Track[]}
      />
    </div>
  );
}
