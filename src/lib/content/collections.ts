import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Collection, CollectionItem } from "./types";

export async function listCollections(): Promise<Collection[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("content_collections")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Collection[];
}

export type CollectionInput = Pick<Collection, "name" | "description" | "sort_order">;

export async function createCollection(input: CollectionInput): Promise<Collection> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("content_collections").insert(input).select().single();
  if (error) throw error;
  return data as Collection;
}

export async function updateCollection(id: string, input: CollectionInput): Promise<Collection> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("content_collections").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Collection;
}

/** Removes the collection and, by cascade, every item in it. */
export async function deleteCollection(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("content_collections").delete().eq("id", id);
  if (error) throw error;
}

export async function listCollectionItems(collectionId?: string): Promise<CollectionItem[]> {
  const supabase = createBrowserSupabaseClient();
  let query = supabase
    .from("content_collection_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (collectionId) query = query.eq("collection_id", collectionId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CollectionItem[];
}

export type CollectionItemInput = Omit<CollectionItem, "id" | "created_at" | "updated_at">;

export async function createCollectionItem(input: CollectionItemInput): Promise<CollectionItem> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("content_collection_items").insert(input).select().single();
  if (error) throw error;
  return data as CollectionItem;
}

export async function updateCollectionItem(id: string, input: CollectionItemInput): Promise<CollectionItem> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("content_collection_items").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as CollectionItem;
}

export async function deleteCollectionItem(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("content_collection_items").delete().eq("id", id);
  if (error) throw error;
}

/** A collection and the items in it, as the hub section editor lists them. */
export interface CollectionWithItems {
  id: string;
  name: string;
  items: { id: string; label: string }[];
}

export async function listCollectionsWithItems(): Promise<CollectionWithItems[]> {
  const [collections, items] = await Promise.all([listCollections(), listCollectionItems()]);
  return collections.map((c) => ({
    id: c.id,
    name: c.name,
    items: items.filter((i) => i.collection_id === c.id).map((i) => ({ id: i.id, label: i.title })),
  }));
}
