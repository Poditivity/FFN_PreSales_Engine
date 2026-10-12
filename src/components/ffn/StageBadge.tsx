import { Badge } from "./Badge";
import type { BadgeTone } from "./Badge";

// Ported verbatim from the FFN design system's bundle.js (StageBadge —
// see .claude/skills/ffn-design-system/components/StageBadge/README.md):
// "The stage list lives in the bundle as FFN.stages. Read it from there
// rather than repeating the labels; a stage renamed once is renamed
// everywhere." `lead` through `advocate` are the ordered pipeline path;
// `nurture`, `dormant` and `lost` are off the path, never shown in a pipeline stepper.
export const STAGES = [
  { id: "lead", label: "Lead", tone: "neutral", hint: "Captured, not yet spoken to." },
  { id: "mql", label: "MQL", tone: "brand", hint: "Qualified on fit by the outreach call." },
  { id: "sql", label: "SQL", tone: "brand", hint: "Discovery call done, intent confirmed." },
  { id: "customer", label: "Customer", tone: "success", hint: "Paid and enrolled." },
  { id: "advocate", label: "Advocate", tone: "success", hint: "Referring or giving testimony." },
  { id: "nurture", label: "Nurture", tone: "neutral", hint: "Not ready yet. Kept warm with regular follow-ups." },
  { id: "dormant", label: "Dormant", tone: "warning", hint: "No reply past the follow-up window." },
  { id: "lost", label: "Lost", tone: "danger", hint: "Declined or disqualified." },
] as const satisfies readonly { id: string; label: string; tone: BadgeTone; hint: string }[];

export type StageId = (typeof STAGES)[number]["id"];

export function stageDef(id: string) {
  return STAGES.find((s) => s.id === id) ?? { id, label: String(id), tone: "neutral" as BadgeTone, hint: "" };
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const def = stageDef(stage);
  return (
    <Badge tone={def.tone} className={className}>
      {def.label}
    </Badge>
  );
}
