// Renders one of the system emails (see ./systemTemplates.ts) from its stored
// template, or from the built-in default when there is no usable row. Used by
// the edge functions that send them.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bodyToEditorHtml, emailBodyToHtml, hasVisibleText, personalizeHtml, personalizeText } from "./messageText.ts";
import { SYSTEM_EMAIL_TEMPLATES, type SystemEmailKey } from "./systemTemplates.ts";

export interface StoredTemplate {
  subject: string | null;
  body: string | null;
}

export interface SystemEmailValues {
  /** Greets the recipient; empty becomes "there". */
  name?: string | null;
  /** Everything else a template can use, by variable key. */
  vars?: Record<string, string | null | undefined>;
  /** HTML for the {{answers}} variable, built by the caller. Never taken from a template. */
  answersHtml?: string;
}

const ANSWERS = /\{\{\s*answers\s*\}\}/;

/** Reads the row for a system email, or null when it is missing, blank or the table is not there yet. */
export async function loadSystemTemplate(
  admin: SupabaseClient,
  key: SystemEmailKey,
): Promise<StoredTemplate | null> {
  try {
    const { data } = await admin.from("email_templates").select("subject, body").eq("system_key", key).maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export function renderSystemEmail(
  key: SystemEmailKey,
  stored: StoredTemplate | null,
  values: SystemEmailValues,
): { subject: string; html: string } {
  const def = SYSTEM_EMAIL_TEMPLATES[key];
  const useStored = !!stored?.subject?.trim() && hasVisibleText(stored?.body ?? "");
  const subjectSource = useStored ? stored!.subject! : def.subject;
  const bodySource = useStored ? stored!.body! : def.body;

  const vars = { ...(values.vars ?? {}) };
  let body = bodyToEditorHtml(bodySource);
  // A paragraph built around a value that is empty (a booking link nobody set up)
  // would read as a broken sentence, so it is left out.
  for (const optional of def.optional) {
    if (vars[optional]) continue;
    const token = new RegExp(`<p>(?:(?!</p>)[\\s\\S])*\\{\\{\\s*${optional}\\s*\\}\\}(?:(?!</p>)[\\s\\S])*</p>`, "g");
    body = body.replace(token, "");
  }

  const subject = personalizeText(subjectSource, values.name, vars).trim();
  const filled = emailBodyToHtml(personalizeHtml(body, values.name, vars));
  const answers = values.answersHtml ?? "";
  // The answers table is HTML the function built itself, so it goes in after the
  // body has been cleaned. On its own line it replaces the paragraph around it.
  const html = filled
    .replace(new RegExp(`<p[^>]*>\\s*${ANSWERS.source}\\s*</p>`, "g"), answers)
    .replace(new RegExp(ANSWERS.source, "g"), answers);
  return { subject, html };
}
