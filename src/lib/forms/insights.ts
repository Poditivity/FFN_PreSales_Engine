import { isInputField, type FieldType, type FormField } from "./formLogic";
import { normalizeSchema } from "./flowModel";

// Ported from build-fellowship's app/src/lib/submissionInsights.js (the real
// source system, examined directly). "Narrative" is no longer an explicit
// field flag — the source infers it from field type/content, so this does
// too: a textarea, or a "text" field long enough to actually be prose.

const TYPEABLE_TYPES: FieldType[] = ["text", "textarea", "email", "phone", "url", "number"];
const NARRATIVE_MIN_CHARS = 60;

export interface FieldTiming {
  focused_at?: number;
  blurred_at?: number;
  duration_ms?: number;
}

export interface SubmissionInsightsInput {
  fields: FormField[];
  data: Record<string, unknown>;
  fieldTimings: Record<string, FieldTiming>;
  keystrokeCounts: Record<string, number>;
  timeOnFormSeconds: number | null;
}

export interface FieldInsight {
  fieldId: string;
  label: string;
  type: FieldType;
  value: unknown;
  text: string;
  typeable: boolean;
  narrative: boolean;
  chars: number;
  words: number;
  keys: number;
  seconds: number;
  typedRatio: number | null;
  pasted: boolean;
  rushed: boolean;
  answered: boolean;
}

export interface SubmissionInsights {
  fields: FieldInsight[];
  totalWords: number;
  totalKeys: number;
  totalChars: number;
  /** Keypresses over characters across everything typeable: the best single tell for a pasted application. */
  typedRatio: number | null;
  pastedFields: FieldInsight[];
  rushedFields: FieldInsight[];
  narrativeWords: number;
  narrativeTypedRatio: number | null;
  answeredFields: number;
  totalFields: number;
  completeness: number;
  timeOnForm: number | null;
  secondsPerAnswer: number;
  flags: {
    pasted: boolean;
    rushed: boolean;
    speedrun: boolean;
    detailed: boolean;
    complete: boolean;
  };
  effortScore: {
    depth: number;
    deliberation: number;
    authenticity: number;
    completeness: number;
    total: number;
  };
  effortBand: "high" | "medium" | "low";
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value === null || value === undefined ? "" : String(value);
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// A long profile URL is not writing — left in the narrative bucket it drags
// the typed-live ratio to the floor for everyone who pasted a LinkedIn link.
const isUrlish = (text: string) => /^https?:\/\//i.test(text.trim()) || /^www\.|linked\s*-?in\.com/i.test(text.trim());

export function computeSubmissionInsights(input: SubmissionInsightsInput): SubmissionInsights {
  const { fields, data, fieldTimings, keystrokeCounts, timeOnFormSeconds } = input;

  const fieldInsights: FieldInsight[] = fields.map((field) => {
    const raw = asText(data[field.id]);
    const text = raw.trim();
    const chars = text.length;
    const keys = keystrokeCounts[field.id] ?? 0;
    const durationMs = fieldTimings[field.id]?.duration_ms ?? 0;
    const seconds = Math.round(durationMs / 100) / 10;
    const answered = chars > 0;

    const narrative =
      field.type !== "url" &&
      !isUrlish(text) &&
      (field.type === "textarea" || (answered && chars >= NARRATIVE_MIN_CHARS && field.type === "text"));
    const typeable = TYPEABLE_TYPES.includes(field.type);
    const typedRatio = typeable && chars > 0 ? clamp01(keys / chars) : null;

    return {
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value: data[field.id],
      text,
      typeable,
      narrative,
      chars,
      words: wordCount(text),
      keys,
      seconds,
      typedRatio,
      pasted: typeable && chars >= 40 && keys < chars * 0.5,
      rushed: narrative && chars >= 40 && seconds > 0 && seconds < 5,
      answered,
    };
  });

  const totalFields = fieldInsights.length;
  const answeredFields = fieldInsights.filter((f) => f.answered);
  const narrativeFields = fieldInsights.filter((f) => f.narrative && f.answered);

  const totalWords = answeredFields.reduce((n, f) => n + f.words, 0);
  const totalKeys = fieldInsights.reduce((n, f) => n + f.keys, 0);
  const totalChars = fieldInsights.reduce((n, f) => n + f.chars, 0);
  const typedRatio = totalChars > 0 ? clamp01(totalKeys / totalChars) : null;
  const pastedFields = fieldInsights.filter((f) => f.pasted);
  const rushedFields = fieldInsights.filter((f) => f.rushed);

  const narrativeWords = narrativeFields.reduce((n, f) => n + f.words, 0);
  const narrativeChars = narrativeFields.reduce((n, f) => n + f.chars, 0);
  const narrativeKeys = narrativeFields.reduce((n, f) => n + f.keys, 0);
  const narrativeTypedRatio = narrativeChars > 0 ? clamp01(narrativeKeys / narrativeChars) : null;

  const completeness = totalFields ? answeredFields.length / totalFields : 0;
  const secondsPerAnswer = answeredFields.length && timeOnFormSeconds ? timeOnFormSeconds / answeredFields.length : 0;

  // Depth (35) — did they actually say anything in the open questions.
  const depth = narrativeFields.length ? clamp01(narrativeWords / 100) * 35 : clamp01(completeness) * 35;
  // Deliberation (25) — time spent per answer, against a ~15s/answer target.
  const deliberation = secondsPerAnswer ? clamp01(secondsPerAnswer / 15) * 25 : 0;
  // Authenticity (25) — typed rather than pasted, judged on prose only; held
  // neutral when there's too little of it to draw a conclusion from.
  const ratioForScore = narrativeChars >= 40 ? narrativeTypedRatio : null;
  const authenticity = ratioForScore === null ? 15 : clamp01((ratioForScore - 0.15) / 0.7) * 25;
  // Completeness (15) — smallest slice: filling every box with one word isn't effort.
  const completenessScore = completeness * 15;

  const effortScoreTotal = Math.round(depth + deliberation + authenticity + completenessScore);
  const effortBand = effortScoreTotal >= 70 ? "high" : effortScoreTotal >= 45 ? "medium" : "low";

  const pastedNarrative = narrativeFields.some((f) => f.pasted);
  const anyRushed = rushedFields.length > 0;
  const speedrun = timeOnFormSeconds !== null && totalFields >= 6 && timeOnFormSeconds < 60;
  const detailed = narrativeWords >= 100;
  const complete = completeness >= 0.99;

  return {
    fields: fieldInsights,
    totalWords,
    totalKeys,
    totalChars,
    typedRatio,
    pastedFields,
    rushedFields,
    narrativeWords,
    narrativeTypedRatio,
    answeredFields: answeredFields.length,
    totalFields,
    completeness,
    timeOnForm: timeOnFormSeconds,
    secondsPerAnswer: Math.round(secondsPerAnswer * 10) / 10,
    flags: { pasted: pastedNarrative, rushed: anyRushed, speedrun, detailed, complete },
    effortScore: {
      depth: Math.round(depth),
      deliberation: Math.round(deliberation),
      authenticity: Math.round(authenticity),
      completeness: Math.round(completenessScore),
      total: effortScoreTotal,
    },
    effortBand,
  };
}

export const EFFORT_BAND_LABEL: Record<SubmissionInsights["effortBand"], string> = {
  high: "High effort",
  medium: "Moderate",
  low: "Low effort",
};

export const FLAG_LABEL: Record<keyof SubmissionInsights["flags"], string> = {
  pasted: "Pasted answers",
  rushed: "Rushed open questions",
  speedrun: "Finished under a minute",
  detailed: "Detailed writing",
  complete: "Fully complete",
};

export type FlagKey = keyof SubmissionInsights["flags"];

const FLAG_ORDER: FlagKey[] = ["pasted", "rushed", "speedrun", "detailed", "complete"];

/** The flags that are set, in the order a reviewer reads them. */
export function activeFlags(insights: SubmissionInsights): FlagKey[] {
  return FLAG_ORDER.filter((k) => insights.flags[k]);
}

/**
 * Question fields in the order a respondent actually meets them: a
 * depth-first walk of the flow graph from the start node, so branches stay
 * together. Raw node order is whatever the builder canvas happened to save.
 */
export function orderedFields(schema: unknown): FormField[] {
  const { nodes, edges } = normalizeSchema(schema);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e.target);
  });

  const seen = new Set<string>();
  const ordered: FormField[] = [];
  const stack = ["start"];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node?.type === "question" && node.data.field && isInputField(node.data.field.type)) ordered.push(node.data.field);
    const next = outgoing.get(id) ?? [];
    for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
  }

  nodes.forEach((n) => {
    if (n.type === "question" && n.data.field && isInputField(n.data.field.type) && !seen.has(n.id)) ordered.push(n.data.field);
  });

  return ordered;
}

// ---- Identity ----------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_A_PERSON =
  /college|school|univ|company|organi[sz]ation|startup|project|product|brand|team|domain|user\s*name|username|institute|firm|business|app|website/i;
const PERSON_NAME = /(^|\b)(full\s*name|your\s*name|name)(\b|$)|applicant|student\s*name|child.*name|parent.*name/i;
const PHONE_LABEL = /phone|mobile|whatsapp|contact\s*(no|number)/i;
const LINKEDIN_LABEL = /linked\s*-?in/i;

function looksLikeName(value: unknown): boolean {
  const v = asText(value).trim();
  if (!v || v.length < 2 || v.length > 60) return false;
  if (v.includes("@") || /https?:\/\//i.test(v) || /(^|\.)\w+\.(com|in|io|org|net)\b/i.test(v)) return false;
  if (/^\+?\d[\d\s()-]{5,}$/.test(v)) return false;
  return true;
}

export interface SubmissionIdentity {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
}

/** Resolve who a submission is from, using the form schema rather than guessing from the shape of the values. */
export function resolveIdentity(data: Record<string, unknown>, fields: FormField[]): SubmissionIdentity {
  const valueOf = (f: FormField) => asText(data[f.id]).trim();
  const pick = (predicate: (f: FormField) => boolean) => {
    const field = fields.find((f) => predicate(f) && valueOf(f));
    return field ? valueOf(field) : "";
  };

  const nameField =
    fields.find((f) => f.type === "name" && looksLikeName(data[f.id])) ??
    fields.find((f) => PERSON_NAME.test(f.label || "") && !NOT_A_PERSON.test(f.label || "") && looksLikeName(data[f.id]));
  let name = nameField ? valueOf(nameField) : "";

  const email =
    pick((f) => f.type === "email") ||
    pick((f) => /e-?mail/i.test(f.label || "")) ||
    Object.values(data).map(asText).find((v) => EMAIL_RE.test(v.trim())) ||
    "";

  const phone = pick((f) => f.type === "phone") || pick((f) => PHONE_LABEL.test(f.label || ""));
  const linkedin =
    pick((f) => LINKEDIN_LABEL.test(f.label || "")) ||
    Object.values(data).map(asText).find((v) => /linkedin\.com|linkdein\.com/i.test(v)) ||
    "";

  if (!name && email) {
    const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
    if (local.length >= 2) name = local.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return { name, email, phone, linkedin };
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return asText(value);
}
