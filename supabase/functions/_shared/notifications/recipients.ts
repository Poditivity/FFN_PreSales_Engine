// Who a form submission is from, as notification recipients need it. Pure
// TypeScript so every edge function (and Vitest) shares it.
//
// Email is the first `email`-type field. Name is a `name`-type field, else a `text`
// field labelled like a person's name (not a startup's or company's). Phone mirrors
// src/lib/forms/insights.ts's resolveIdentity: a `phone`-type field first,
// then any field labelled like a phone/mobile/WhatsApp number. Keep the two
// in sync if either changes.

export interface SubmissionField {
  id: string;
  label: string;
  type: string;
}

export interface SubmissionContact {
  name: string;
  email: string;
  phone: string;
}

const PHONE_LABEL = /phone|mobile|whatsapp|contact\s*(no|number)/i;
// A text question whose label says "name" but is about a thing, not the person
// ("Startup name", "Company name"). Mirrors insights.ts's resolveIdentity.
const NOT_A_PERSON =
  /college|school|univ|company|organi[sz]ation|startup|project|product|brand|team|domain|user\s*name|username|institute|firm|business|app|website/i;

function answer(data: Record<string, unknown>, field: SubmissionField | undefined): string {
  if (!field) return "";
  const raw = data[field.id];
  return (Array.isArray(raw) ? raw.join(", ") : String(raw ?? "")).trim();
}

/**
 * The question that holds the submitter's own name. A Name-type question wins
 * whatever its position; otherwise a text question labelled like a name, unless
 * it is the name of a startup/company/etc. An unanswered question is skipped.
 */
export function findNameField(data: Record<string, unknown>, fields: SubmissionField[]): SubmissionField | undefined {
  const answered = (f: SubmissionField) => answer(data, f) !== "";
  return (
    fields.find((f) => f.type === "name" && answered(f)) ??
    fields.find((f) => f.type === "text" && /name/i.test(f.label ?? "") && !NOT_A_PERSON.test(f.label ?? "") && answered(f))
  );
}

export function resolveSubmissionContact(data: Record<string, unknown>, fields: SubmissionField[]): SubmissionContact {
  const email = answer(data, fields.find((f) => f.type === "email"));
  const name = answer(data, findNameField(data, fields));
  const pickPhone = (predicate: (f: SubmissionField) => boolean) => answer(data, fields.find((f) => predicate(f) && answer(data, f)));
  const phone = pickPhone((f) => f.type === "phone") || pickPhone((f) => PHONE_LABEL.test(f.label ?? ""));
  return { name, email, phone };
}
