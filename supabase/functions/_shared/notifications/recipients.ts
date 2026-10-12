// Who a form submission is from, as notification recipients need it. Pure
// TypeScript so every edge function (and Vitest) shares it.
//
// Email and name follow the rule every edge function already used (first
// `email`-type field; first `text` field labelled like a name). Phone mirrors
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

function answer(data: Record<string, unknown>, field: SubmissionField | undefined): string {
  if (!field) return "";
  const raw = data[field.id];
  return (Array.isArray(raw) ? raw.join(", ") : String(raw ?? "")).trim();
}

export function resolveSubmissionContact(data: Record<string, unknown>, fields: SubmissionField[]): SubmissionContact {
  const email = answer(data, fields.find((f) => f.type === "email"));
  const name = answer(data, fields.find((f) => f.type === "text" && /name/i.test(f.label ?? "")));
  const pickPhone = (predicate: (f: SubmissionField) => boolean) => answer(data, fields.find((f) => predicate(f) && answer(data, f)));
  const phone = pickPhone((f) => f.type === "phone") || pickPhone((f) => PHONE_LABEL.test(f.label ?? ""));
  return { name, email, phone };
}
