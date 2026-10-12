"use client";

import { BadgeCheck, Clock, Compass, Info, Save, Target, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Badge, Button, Input, Textarea } from "@/components/ffn";
import { TagListInput } from "@/components/content/TagListInput";
import { formatIST } from "@/lib/forms/ist";
import { updateFfnProfile, type FfnProfile, type FfnProfileInput } from "@/lib/hubs/ffnProfile";
import { BLOCK_LABELS, type BlockType } from "@/lib/hubs/types";

const EMPTY: FfnProfileInput = {
  one_liner: null,
  helps_founders_do: null,
  approach: null,
  differentiator: null,
  founder_stages_supported: [],
  startup_stages_supported: [],
  founder_types: [],
  industries: [],
  problems_addressed: [],
  support_formats: [],
  credibility_founders_stat: null,
  credibility_programs_stat: null,
  credibility_events_stat: null,
  credibility_partnerships_stat: null,
  website_url: null,
};

type Key = keyof FfnProfileInput;

// Only the editable fields, so the server row's id and updated_at are never
// sent back as if they were edits.
function toInput(profile: FfnProfile | null): FfnProfileInput {
  if (!profile) return { ...EMPTY };
  const input = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as Key[]) {
    (input as Record<Key, unknown>)[key] = profile[key];
  }
  return input;
}

function isFilled(value: FfnProfileInput[Key]): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim() !== "";
}

interface Section {
  id: string;
  title: string;
  /** A shorter name for the navigator, which is narrow. */
  navLabel: string;
  description: string;
  /** The hub block this section fills. A hub skips the block when nothing here is filled in. */
  block: BlockType;
  icon: LucideIcon;
  keys: Key[];
}

const SECTIONS: Section[] = [
  {
    id: "what",
    navLabel: "What is FFN?",
    title: "What is FFN?",
    description: "How FFN introduces itself to an applicant. The one-liner sits under the block heading.",
    block: "about",
    icon: Info,
    keys: ["one_liner", "helps_founders_do", "approach", "differentiator", "website_url"],
  },
  {
    id: "who",
    navLabel: "Who it is for",
    title: "Who FFN is for",
    description: "The founders and startups the network is built around.",
    block: "who_for",
    icon: Users,
    keys: ["founder_stages_supported", "startup_stages_supported", "founder_types", "industries"],
  },
  {
    id: "helps",
    navLabel: "What it helps with",
    title: "What FFN helps with",
    description: "The problems a founder brings to FFN.",
    block: "helps_with",
    icon: Target,
    keys: ["problems_addressed"],
  },
  {
    id: "how",
    navLabel: "How it supports",
    title: "How FFN supports founders",
    description: "The programs and formats a founder can take part in.",
    block: "how_supports",
    icon: Compass,
    keys: ["support_formats"],
  },
  {
    id: "credibility",
    navLabel: "Credibility",
    title: "FFN credibility",
    description: "Numbers that show the reach of the network, also written by you.",
    block: "credibility",
    icon: BadgeCheck,
    keys: ["credibility_founders_stat", "credibility_programs_stat", "credibility_events_stat", "credibility_partnerships_stat"],
  },
];

const TOTAL_FIELDS = SECTIONS.reduce((n, s) => n + s.keys.length, 0);

export function FfnProfileEditor({ initialProfile }: { initialProfile: FfnProfile | null }) {
  const [form, setForm] = useState<FfnProfileInput>(() => toInput(initialProfile));
  // The last value that reached the database, so "unsaved" means a real difference.
  const [baseline, setBaseline] = useState(() => JSON.stringify(toInput(initialProfile)));
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialProfile?.updated_at ?? null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);

  const set = (patch: Partial<FfnProfileInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setJustSaved(false);
  };
  const text = (key: Key) => (form[key] as string | null) ?? "";
  const setText = (key: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set({ [key]: e.target.value || null } as Partial<FfnProfileInput>);

  const filledIn = (section: Section) => section.keys.filter((k) => isFilled(form[k])).length;
  const totalFilled = SECTIONS.reduce((n, s) => n + filledIn(s), 0);

  // A profile that took a while to write should not vanish on a stray tab close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateFfnProfile(form);
      const next = toInput(saved);
      setForm(next);
      setBaseline(JSON.stringify(next));
      setUpdatedAt(saved.updated_at);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fields: Record<string, ReactNode> = {
    what: (
      <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        <Input
          label="One-line description"
          hint="A single sentence. It sits directly under the block heading."
          value={text("one_liner")}
          onChange={setText("one_liner")}
        />
        <Textarea label="What FFN helps founders do" rows={3} value={text("helps_founders_do")} onChange={setText("helps_founders_do")} />
        <Textarea label="Approach and methodology" rows={3} value={text("approach")} onChange={setText("approach")} />
        <Textarea label="What makes FFN different" rows={3} value={text("differentiator")} onChange={setText("differentiator")} />
        <Input
          label="FFN website"
          placeholder="https://…"
          hint="Adds a link to the bottom of the block."
          value={text("website_url")}
          onChange={setText("website_url")}
        />
      </div>
    ),
    who: (
      <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
        <TagListInput
          label="Founder stages supported"
          value={form.founder_stages_supported}
          onChange={(founder_stages_supported) => set({ founder_stages_supported })}
          placeholder="e.g. Pre-idea"
        />
        <TagListInput
          label="Startup stages supported"
          value={form.startup_stages_supported}
          onChange={(startup_stages_supported) => set({ startup_stages_supported })}
          placeholder="e.g. Pre-seed"
        />
        <TagListInput
          label="Founder types"
          value={form.founder_types}
          onChange={(founder_types) => set({ founder_types })}
          placeholder="e.g. First-time founder"
        />
        <TagListInput
          label="Industries"
          value={form.industries}
          onChange={(industries) => set({ industries })}
          placeholder="e.g. Fintech"
        />
      </div>
    ),
    helps: (
      <TagListInput
        label="Key problems addressed"
        value={form.problems_addressed}
        onChange={(problems_addressed) => set({ problems_addressed })}
        placeholder="e.g. Idea validation"
      />
    ),
    how: (
      <TagListInput
        label="Programs and support formats"
        value={form.support_formats}
        onChange={(support_formats) => set({ support_formats })}
        placeholder="e.g. 1:1 mentoring"
      />
    ),
    credibility: (
      <div className="about-stats">
        <Input label="Founders supported" mono placeholder="e.g. 100+" value={text("credibility_founders_stat")} onChange={setText("credibility_founders_stat")} />
        <Input label="Programs delivered" mono placeholder="e.g. 6" value={text("credibility_programs_stat")} onChange={setText("credibility_programs_stat")} />
        <Input label="Events" mono placeholder="e.g. 20+" value={text("credibility_events_stat")} onChange={setText("credibility_events_stat")} />
        <Input label="Partnerships" mono placeholder="e.g. 15" value={text("credibility_partnerships_stat")} onChange={setText("credibility_partnerships_stat")} />
      </div>
    ),
  };

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {/* How complete the profile is, and when it last changed. */}
      <div className="about-summary">
        <div style={{ flex: "1 1 calc(var(--space-16) * 3)", minWidth: 0 }}>
          <div className="flex items-baseline justify-between" style={{ gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            <span className="label">Profile</span>
            <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
              <span className="data-sm">{totalFilled}</span> of <span className="data-sm">{TOTAL_FIELDS}</span> fields filled
            </span>
          </div>
          <div className="subs-track" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={TOTAL_FIELDS} aria-valuenow={totalFilled}>
            <span className="subs-fill" style={{ width: `${(totalFilled / TOTAL_FIELDS) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <span className="about-icon" aria-hidden="true">
            <Clock size={18} strokeWidth={1.75} />
          </span>
          <div>
            <div className="caption" style={{ color: "var(--ink-subtle)" }}>
              Last updated
            </div>
            <div className="data-sm">{updatedAt ? formatIST(updatedAt) : "Never"}</div>
          </div>
        </div>
      </div>

      <div className="about-panel">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const n = filledIn(s);
          return (
            <section key={s.id} id={s.id} className="about-section" aria-labelledby={`${s.id}-title`}>
              <div className="flex flex-col" style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
                <span className="about-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <h2 id={`${s.id}-title`} className="h3">
                    {s.title}
                  </h2>
                  <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
                    {s.description}
                  </p>
                </div>
                <div className="flex flex-col" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
                  <Badge tone={n === s.keys.length ? "success" : "neutral"} dot={n === s.keys.length}>
                    {n === s.keys.length ? "Complete" : n === 0 ? "Empty" : `${n} of ${s.keys.length} filled`}
                  </Badge>
                  <p className="caption" style={{ color: "var(--ink-subtle)", margin: 0 }}>
                    Fills the <strong style={{ fontWeight: 500, color: "var(--ink-muted)" }}>{BLOCK_LABELS[s.block]}</strong> block on every
                    hub.
                    {n === 0 && " Hubs skip it until something is added."}
                  </p>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>{fields[s.id]}</div>
            </section>
          );
        })}
      </div>

      {error && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}

      <div className="about-savebar" role="region" aria-label="Save profile">
        <div className="flex items-center" style={{ gap: "var(--space-3)", minWidth: 0 }} role="status">
          {dirty ? (
            <Badge tone="warning">Unsaved changes</Badge>
          ) : justSaved ? (
            <Badge tone="success">Saved</Badge>
          ) : (
            <Badge tone="neutral">No changes</Badge>
          )}
          <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
            {dirty
              ? "Select Save profile to update every hub."
              : justSaved
                ? "Every hub now shows the updated profile."
                : "Everything here is optional."}
          </span>
        </div>
        <Button onClick={save} loading={saving} disabled={!dirty} iconLeft={<Save size={15} />}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
