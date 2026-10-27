"use client";

import { ChevronDown, ChevronUp, GripVertical, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RichTextEditor } from "@/app/admin/messaging/RichTextEditor";
import { ImageUploadField } from "@/components/content/ImageUploadField";
import { Button, Card, Checkbox, Input, Select, Textarea } from "@/components/ffn";
import { HubSectionFrame } from "@/components/hubs/HubSectionFrame";
import { CustomBlock } from "@/app/hub/[token]/customBlocks";
import { listCollectionsWithItems, type CollectionWithItems } from "@/lib/content/collections";
import { isHttpUrl } from "@/lib/content/validation";
import {
  BLOCK_DEFAULTS,
  BLOCK_LABELS,
  BLOCK_TYPES,
  defaultModule,
  isRepeatableModule,
  isSingletonBlockType,
  moduleKey,
  newRepeatableModule,
  type BlockType,
  type HubModule,
  type HubModuleLink,
  type RepeatableBlockType,
} from "@/lib/hubs/types";

export interface ItemOption {
  id: string;
  label: string;
}

/**
 * Makes sure every fixed block is present, and leaves the order the modules
 * were given in: the order is the order of the sections on the hub page. A fixed
 * block that is missing (a template saved before it existed) is slotted in after
 * the block that precedes it in the standard order. A new list starts in the
 * standard order. Custom and collection sections are kept as they are.
 */
export function normalizeModules(modules: HubModule[]): HubModule[] {
  const result = [...modules];
  BLOCK_TYPES.forEach((type, i) => {
    if (result.some((m) => m.type === type)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const found = result.findIndex((m) => m.type === BLOCK_TYPES[j]);
      if (found !== -1) {
        at = found + 1;
        break;
      }
    }
    result.splice(at, 0, defaultModule(type));
  });
  return result;
}

/** Moves the section `fromKey` to just before or just after the section `toKey`. */
export function reorderModules(
  modules: HubModule[],
  fromKey: string,
  toKey: string,
  place: "before" | "after",
): HubModule[] {
  if (fromKey === toKey) return modules;
  const moving = modules.find((m) => moduleKey(m) === fromKey);
  if (!moving) return modules;
  const rest = modules.filter((m) => moduleKey(m) !== fromKey);
  const target = rest.findIndex((m) => moduleKey(m) === toKey);
  if (target === -1) return modules;
  rest.splice(place === "before" ? target : target + 1, 0, moving);
  return rest;
}

const KIND_OPTIONS: { value: RepeatableBlockType; label: string }[] = [
  { value: "custom", label: "Custom section: your own heading, text, image and button" },
  { value: "collection", label: "Collection: a list from the Content database" },
];

// Title/Subtitle above are just this block's cosmetic heading on the hub
// page — they are never enough on their own to make a singleton block
// appear (see hasContent in hub-hydrate). Each of these points staff at
// where the block's actual content is entered, so "I set a title but
// nothing shows" doesn't happen again.
const SINGLETON_HINTS: Partial<Record<BlockType, { text: string; href?: string; linkLabel?: string }>> = {
  welcome: {
    text: "Pulled from this hub's own Lead Context, not from here — set startup name, founder stage and current context when creating or editing this hub.",
  },
  about: {
    text: "This block's content (one-liner, approach, differentiator) comes from the About FFN profile, not from Title/Subtitle above.",
    href: "/admin/settings/ffn-profile",
    linkLabel: "Edit About FFN →",
  },
  who_for: {
    text: "This block's content (founder/startup stages, founder types, industries) comes from the About FFN profile.",
    href: "/admin/settings/ffn-profile",
    linkLabel: "Edit About FFN →",
  },
  helps_with: {
    text: "This block's content (problems addressed) comes from the About FFN profile.",
    href: "/admin/settings/ffn-profile",
    linkLabel: "Edit About FFN →",
  },
  how_supports: {
    text: "This block's content (support formats) comes from the About FFN profile.",
    href: "/admin/settings/ffn-profile",
    linkLabel: "Edit About FFN →",
  },
  credibility: {
    text: "This block's numbers come from the About FFN profile's credibility stats.",
    href: "/admin/settings/ffn-profile",
    linkLabel: "Edit About FFN →",
  },
  cta: {
    text: "The booking link and button text come from the settings card below this editor, not from here.",
  },
};

/** What a text box shows: the saved text, or the default when nothing has been saved. */
function textOf(saved: string | null | undefined, fallback: string, dynamic?: boolean): string {
  if (saved != null) return saved;
  return dynamic ? "" : fallback;
}

/** When a box is left, an empty one or one that matches the default goes back to "use the default" (null). */
function settleText(saved: string | null | undefined, fallback: string): string | null {
  if (saved == null) return null;
  return saved.trim() === "" || saved === fallback ? null : saved;
}

/** A section back as it starts: a fixed block to its defaults, an added one emptied but still there under its name. */
function resetModule(mod: HubModule): HubModule {
  if (mod.type === "custom") {
    return { ...mod, subtitle: null, body: "", image_url: null, button_label: null, button_url: null };
  }
  if (mod.type === "collection") {
    return { ...mod, subtitle: null, mode: "auto", ids: [], featured_only: false, limit: null };
  }
  return { ...defaultModule(mod.type), enabled: mod.enabled };
}

function describeModule(mod: HubModule, collections: CollectionWithItems[] | null): string {
  if (!mod.enabled) return "Off";
  if (mod.type === "custom") return "Custom section";
  if (mod.type === "collection") {
    const name = collections?.find((c) => c.id === mod.collection_id)?.name;
    if (!mod.collection_id) return "Collection · pick one";
    return `Collection${name ? `: ${name}` : ""} · ${describeSelection(mod)}`;
  }
  if (isSingletonBlockType(mod.type)) return "On";
  if (mod.type === "links") return `${mod.links.length} link${mod.links.length === 1 ? "" : "s"}`;
  return describeSelection(mod);
}

function describeSelection(mod: HubModule): string {
  if (mod.mode === "manual") return `Hand-picked · ${mod.ids.length} item${mod.ids.length === 1 ? "" : "s"}`;
  const parts = ["Automatic"];
  if (mod.featured_only) parts.push("featured only");
  parts.push(mod.limit != null ? `up to ${mod.limit}` : "no limit");
  return parts.join(" · ");
}

function labelOf(mod: HubModule, collections: CollectionWithItems[] | null): string {
  if (mod.type === "custom") return mod.title?.trim() || "Custom section";
  if (mod.type === "collection") {
    return mod.title?.trim() || collections?.find((c) => c.id === mod.collection_id)?.name || "Collection";
  }
  return BLOCK_LABELS[mod.type];
}

export function ModuleComposer({
  value,
  onChange,
  itemsByType,
}: {
  value: HubModule[];
  onChange: (modules: HubModule[]) => void;
  itemsByType: Record<BlockType, ItemOption[]>;
}) {
  const modules = normalizeModules(value);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The content database's collections, for collection sections.
  const [collections, setCollections] = useState<CollectionWithItems[] | null>(null);
  const [adding, setAdding] = useState<{ kind: RepeatableBlockType; name: string }>({ kind: "custom", name: "" });

  useEffect(() => {
    listCollectionsWithItems()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  function update(key: string, patch: Partial<HubModule>) {
    onChange(modules.map((m) => (moduleKey(m) === key ? { ...m, ...patch } : m)));
  }

  function move(key: string, by: -1 | 1) {
    const from = modules.findIndex((m) => moduleKey(m) === key);
    const to = from + by;
    if (from === -1 || to < 0 || to >= modules.length) return;
    const next = [...modules];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  // Drag and drop: the grip is the only thing that starts a drag, so text boxes
  // inside an open section still select text normally.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ key: string; place: "before" | "after" } | null>(null);

  function endDrag() {
    setDragKey(null);
    setDropAt(null);
  }

  function drop() {
    if (dragKey && dropAt) onChange(reorderModules(modules, dragKey, dropAt.key, dropAt.place));
    endDrag();
  }

  function remove(key: string) {
    onChange(modules.filter((m) => moduleKey(m) !== key));
    if (openKey === key) setOpenKey(null);
  }

  function addSection() {
    const mod = newRepeatableModule(adding.kind, adding.name);
    onChange([...modules, mod]);
    setOpenKey(moduleKey(mod));
    setAdding({ kind: adding.kind, name: "" });
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
        Sections appear on the hub in this order. Drag a section by its handle, or use the arrows, to move it. Add your own at the bottom.
      </p>
      {modules.map((mod, index) => {
        const key = moduleKey(mod);
        const repeatable = isRepeatableModule(mod);
        const fixed = mod.type as BlockType;
        const collection = mod.type === "collection" ? collections?.find((c) => c.id === mod.collection_id) : undefined;
        // What a hand-picked list can offer: the content type's items, or the collection's.
        const options = mod.type === "collection" ? (collection?.items ?? []) : repeatable ? [] : (itemsByType[fixed] ?? []);
        const pickedIds = new Set(mod.ids);
        const available = options.filter((o) => !pickedIds.has(o.id));
        const isOpen = openKey === key;
        const label = labelOf(mod, collections);
        const listed = mod.type === "collection" || (!repeatable && !isSingletonBlockType(fixed) && fixed !== "links");

        const dropHere = dragKey && dragKey !== key && dropAt?.key === key ? dropAt.place : null;
        const indicator = "2px solid var(--focus-ring)";

        return (
          <div
            key={key}
            data-section-key={key}
            onDragOver={(e) => {
              if (!dragKey || dragKey === key) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const box = e.currentTarget.getBoundingClientRect();
              const place = e.clientY < box.top + box.height / 2 ? "before" : "after";
              if (dropAt?.key !== key || dropAt.place !== place) setDropAt({ key, place });
            }}
            onDrop={(e) => {
              if (!dragKey) return;
              e.preventDefault();
              drop();
            }}
            style={{
              opacity: dragKey === key ? 0.5 : 1,
              // The drop line is a border that is always 2px (transparent when idle), so nothing moves while a drag is under way.
              borderTop: dropHere === "before" ? indicator : "2px solid transparent",
              borderBottom: dropHere === "after" ? indicator : "2px solid transparent",
            }}
          >
          <Card>
            <div className="flex items-center justify-between" style={{ gap: "var(--space-3)" }}>
              <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
                <span
                  role="img"
                  aria-label={`Drag ${label} to move it`}
                  title="Drag to move"
                  className="section-grip"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", key);
                    const card = e.currentTarget.closest<HTMLElement>("[data-section-key]");
                    if (card) e.dataTransfer.setDragImage(card, 16, 16);
                    setDragKey(key);
                  }}
                  onDragEnd={endDrag}
                >
                  <GripVertical size={18} strokeWidth={1.75} />
                </span>
                <Checkbox
                  label={<span className="body-medium">{label}</span>}
                  hint={describeModule(mod, collections)}
                  checked={mod.enabled}
                  onChange={(e) => update(key, { enabled: e.target.checked })}
                />
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                {mod.type !== "welcome" && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${label} up`}
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => move(key, -1)}
                    >
                      <ChevronUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${label} down`}
                      title="Move down"
                      disabled={index === modules.length - 1}
                      onClick={() => move(key, 1)}
                    >
                      <ChevronDown size={16} />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!mod.enabled}
                  aria-label={isOpen ? `Collapse ${label} settings` : `Configure ${label}`}
                  title={isOpen ? "Close settings" : "Settings"}
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  style={isOpen ? { color: "var(--brand)" } : undefined}
                >
                  <SlidersHorizontal size={16} />
                </Button>
                {repeatable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${label}`}
                    title="Remove this section"
                    onClick={() => remove(key)}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </div>

            {isOpen && mod.enabled && (
              <div
                className="flex flex-col"
                style={{
                  gap: "var(--space-4)",
                  marginTop: "var(--space-4)",
                  paddingTop: "var(--space-4)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {repeatable ? (
                  <>
                    <Input
                      label="Title"
                      placeholder={mod.type === "custom" ? "Section title" : (collection?.name ?? "Collection name")}
                      hint="Shown as this section's heading on the hub page."
                      value={mod.title ?? ""}
                      onChange={(e) => update(key, { title: e.target.value || null })}
                    />
                    <Textarea
                      label="Subtitle"
                      rows={2}
                      hint="Optional. A line under the heading."
                      value={mod.subtitle ?? ""}
                      onChange={(e) => update(key, { subtitle: e.target.value || null })}
                    />
                  </>
                ) : (
                  <>
                    <Input
                      label="Title"
                      placeholder={BLOCK_DEFAULTS[fixed].title}
                      hint={
                        BLOCK_DEFAULTS[fixed].dynamic?.title
                          ? `Default: ${BLOCK_DEFAULTS[fixed].title}, filled in for each applicant. Leave blank to use it.`
                          : "The default heading is filled in. Change it, or use Reset to default."
                      }
                      value={textOf(mod.title, BLOCK_DEFAULTS[fixed].title, BLOCK_DEFAULTS[fixed].dynamic?.title)}
                      onChange={(e) => update(key, { title: e.target.value })}
                      onBlur={() => update(key, { title: settleText(mod.title, BLOCK_DEFAULTS[fixed].title) })}
                    />
                    <Textarea
                      label="Subtitle"
                      rows={2}
                      placeholder={BLOCK_DEFAULTS[fixed].subtitle || undefined}
                      hint={
                        BLOCK_DEFAULTS[fixed].dynamic?.subtitle
                          ? `Default: ${BLOCK_DEFAULTS[fixed].subtitle}. Leave blank to use it.`
                          : BLOCK_DEFAULTS[fixed].subtitle
                            ? "The default subtitle is filled in. Change it, or use Reset to default."
                            : "Default: none. Leave blank to show no subtitle."
                      }
                      value={textOf(mod.subtitle, BLOCK_DEFAULTS[fixed].subtitle, BLOCK_DEFAULTS[fixed].dynamic?.subtitle)}
                      onChange={(e) => update(key, { subtitle: e.target.value })}
                      onBlur={() => update(key, { subtitle: settleText(mod.subtitle, BLOCK_DEFAULTS[fixed].subtitle) })}
                    />
                  </>
                )}

                {!repeatable && SINGLETON_HINTS[fixed] && (
                  <p className="caption" style={{ color: "var(--ink-subtle)" }}>
                    {SINGLETON_HINTS[fixed]!.text}
                    {SINGLETON_HINTS[fixed]!.href && (
                      <>
                        {" "}
                        <Link href={SINGLETON_HINTS[fixed]!.href!} style={{ color: "var(--brand)" }}>
                          {SINGLETON_HINTS[fixed]!.linkLabel}
                        </Link>
                      </>
                    )}
                  </p>
                )}

                {mod.type === "custom" && <CustomFields mod={mod} onChange={(patch) => update(key, patch)} />}

                {mod.type === "collection" && (
                  <div>
                    <Select
                      label="Collection"
                      value={mod.collection_id ?? ""}
                      placeholder={collections === null ? "Loading collections" : collections.length === 0 ? "No collections yet" : "Pick a collection"}
                      disabled={!collections || collections.length === 0}
                      options={(collections ?? []).map((c) => ({ value: c.id, label: c.name }))}
                      // Hand-picked ids belong to one collection, so changing it starts the pick again.
                      onChange={(e) => update(key, { collection_id: e.target.value || null, ids: [] })}
                      hint={
                        collections && collections.length === 0
                          ? "Create a collection under Content database, Collections first."
                          : "Only public items appear on the hub."
                      }
                    />
                  </div>
                )}

                {mod.type === "links" ? (
                  <LinksEditor links={mod.links} onChange={(links) => update(key, { links })} />
                ) : listed && (mod.type !== "collection" || mod.collection_id) ? (
                  <>
                    <div>
                      <span className="label" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                        Selection
                      </span>
                      <span className="caption" style={{ display: "block", color: "var(--ink-muted)", marginBottom: "var(--space-2)" }}>
                        Default: Automatic, every item that suits the track, no limit.
                      </span>
                      <div className="flex" style={{ gap: "var(--space-2)" }}>
                        <Button
                          type="button"
                          size="sm"
                          variant={mod.mode === "auto" ? "primary" : "secondary"}
                          onClick={() => update(key, { mode: "auto" })}
                        >
                          Automatic (default)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={mod.mode === "manual" ? "primary" : "secondary"}
                          onClick={() => update(key, { mode: "manual" })}
                        >
                          Hand-picked
                        </Button>
                      </div>
                    </div>

                    {mod.mode === "auto" ? (
                      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-4)" }}>
                        <Checkbox
                          label="Featured only"
                          hint="Default: off"
                          checked={mod.featured_only}
                          onChange={(e) => update(key, { featured_only: e.target.checked })}
                        />
                        <Input
                          type="number"
                          label="How many to show"
                          hint="Default: no limit. Leave blank for none."
                          value={mod.limit ?? ""}
                          onChange={(e) => update(key, { limit: e.target.value === "" ? null : Number(e.target.value) })}
                          style={{ maxWidth: 160 }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                        {mod.ids.length > 0 && (
                          <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
                            {mod.ids.map((id) => {
                              const item = options.find((o) => o.id === id);
                              return (
                                <div
                                  key={id}
                                  className="flex items-center justify-between"
                                  style={{ padding: "var(--space-1) var(--space-2)", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}
                                >
                                  <span className="body-sm">{item?.label ?? id}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Remove ${item?.label ?? id}`}
                                    onClick={() => update(key, { ids: mod.ids.filter((i) => i !== id) })}
                                  >
                                    <X size={13} />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {available.length > 0 && (
                          <Select
                            value=""
                            placeholder="Add an item"
                            options={available.map((o) => ({ value: o.id, label: o.label }))}
                            onChange={(e) => {
                              if (e.target.value) update(key, { ids: [...mod.ids, e.target.value] });
                            }}
                          />
                        )}
                      </div>
                    )}
                  </>
                ) : null}

                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconLeft={<RotateCcw size={14} />}
                    onClick={() => onChange(modules.map((m) => (moduleKey(m) === key ? resetModule(m) : m)))}
                  >
                    Reset to default
                  </Button>
                </div>
              </div>
            )}
          </Card>
          </div>
        );
      })}

      <Card title="Add a section" subtitle="Your own text, or a list from a collection in the Content database.">
        <div className="flex items-end flex-wrap" style={{ gap: "var(--space-3)" }}>
          <Select
            label="Kind"
            value={adding.kind}
            options={KIND_OPTIONS}
            onChange={(e) => setAdding((a) => ({ ...a, kind: e.target.value as RepeatableBlockType }))}
            style={{ minWidth: 280 }}
          />
          <Input
            label="Section name"
            placeholder={adding.kind === "custom" ? "Our story" : "Upcoming events"}
            value={adding.name}
            onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (adding.name.trim()) addSection();
              }
            }}
            style={{ minWidth: 220 }}
          />
          <Button type="button" iconLeft={<Plus size={15} />} disabled={!adding.name.trim()} onClick={addSection}>
            Add section
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** A custom section's own content: rich text, an image and a button. */
function CustomFields({ mod, onChange }: { mod: HubModule; onChange: (patch: Partial<HubModule>) => void }) {
  const buttonError =
    mod.button_url && !isHttpUrl(mod.button_url) ? "Enter a full link that starts with https://" : undefined;
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <RichTextEditor
        label="Section text"
        minHeight={180}
        value={mod.body ?? ""}
        onChange={(body) => onChange({ body })}
        // The Preview tab shows the whole section as the applicant sees it: heading,
        // text, image and button, on the hub's own light page.
        renderPreview={(html) => (
          <HubSectionFrame>
            <CustomBlock
              id="section-preview"
              title={mod.title?.trim() || "Section title"}
              subtitle={mod.subtitle}
              body={html}
              imageUrl={mod.image_url ?? null}
              buttonLabel={mod.button_label ?? null}
              buttonUrl={mod.button_url && isHttpUrl(mod.button_url) ? mod.button_url : null}
              onButtonClick={() => {}}
            />
          </HubSectionFrame>
        )}
      />
      <ImageUploadField
        label="Image"
        folder="hubs/sections"
        testId={`hub-section-${mod.id ?? "image"}`}
        value={mod.image_url ?? null}
        onChange={(image_url) => onChange({ image_url })}
      />
      <div className="hubform-grid">
        <Input
          label="Button text"
          placeholder="Read more"
          hint="Optional. The button shows when it has a text and a link."
          value={mod.button_label ?? ""}
          onChange={(e) => onChange({ button_label: e.target.value || null })}
        />
        <Input
          label="Button link"
          placeholder="https://"
          error={buttonError}
          value={mod.button_url ?? ""}
          onChange={(e) => onChange({ button_url: e.target.value || null })}
        />
      </div>
    </div>
  );
}

// Fully admin-defined repeatable list for the "links" block — no hardcoded
// "website/case study/testimonial" slots, staff can add or remove any
// number of {label, url} pairs, none required.
function LinksEditor({ links, onChange }: { links: HubModuleLink[]; onChange: (links: HubModuleLink[]) => void }) {
  function update(i: number, patch: Partial<HubModuleLink>) {
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      {links.map((link, i) => (
        <div key={i} className="flex items-end" style={{ gap: "var(--space-2)" }}>
          <Input
            label={i === 0 ? "Label" : undefined}
            placeholder="Label"
            value={link.label}
            onChange={(e) => update(i, { label: e.target.value })}
            style={{ flex: 1 }}
          />
          <Input
            label={i === 0 ? "URL" : undefined}
            placeholder="https://…"
            value={link.url}
            onChange={(e) => update(i, { url: e.target.value })}
            style={{ flex: 2 }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Remove link"
            onClick={() => onChange(links.filter((_, idx) => idx !== i))}
          >
            <X size={13} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconLeft={<Plus size={14} />}
        onClick={() => onChange([...links, { label: "", url: "" }])}
      >
        Add link
      </Button>
    </div>
  );
}
