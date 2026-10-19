// _shared/hubIdentity.ts — shared by hub-hydrate and hub-send, the only two
// edge functions that need to resolve who a hub is for. Previously each
// function carried its own copy of this (extractFields + the lead-lookup/
// applicant_* branch) because Deno can't import from the Next.js source
// tree where src/lib/hubs/identity.ts's smaller resolveHubIdentity lives —
// that's a different function (it takes an already-resolved lead identity
// as a parameter) and was never the source of this duplication. This file
// is the actual fix: one copy, imported by both, same shape as
// _shared/email.ts being the one copy every mail-sending function imports.
//
// A hub with a real lead derives identity from that lead's own form
// submission — hubs never store a second copy of a lead's name/email
// (Phase 2's "derive, don't duplicate" rule). A hub with no lead (a
// standalone applicant staff entered directly) carries its own
// applicant_name/applicant_email instead; see the
// hubs_standalone_applicants migration.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveSubmissionContact } from "./notifications/recipients.ts";

export interface SchemaField {
  id: string;
  label: string;
  type: string;
}

export function extractFields(schema: unknown): SchemaField[] {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, unknown>;
  const nodes: unknown[] = Array.isArray(s.nodes) ? (s.nodes as unknown[]) : [];
  return nodes
    .filter((n) => (n as Record<string, unknown>)?.type === "question")
    .map((n) => (n as Record<string, unknown>)?.data as Record<string, unknown>)
    .map((d) => d?.field as Record<string, unknown>)
    .filter(Boolean) as SchemaField[];
}

export function resolveSubmissionIdentity(
  data: Record<string, unknown>,
  fields: SchemaField[],
): HubIdentity {
  const emailField = fields.find((f) => f.type === "email");
  const email = emailField ? String(data[emailField.id] ?? "").trim() : "";
  const nameField = fields.find((f) => f.type === "name" || (f.type === "text" && /name/i.test(f.label ?? "")));
  const name = nameField ? String(data[nameField.id] ?? "").trim() : "";
  return { name, email, phone: resolveSubmissionContact(data, fields).phone };
}

export interface HubIdentity {
  name: string;
  email: string;
  phone: string;
}

export interface HubIdentityRow {
  lead_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_whatsapp?: string | null;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// The main export. Used by both hub-hydrate (only reads .name, for the
// welcome block) and hub-send (needs .email/.phone too, to actually send).
export async function resolveHubIdentity(hub: HubIdentityRow): Promise<HubIdentity> {
  if (!hub.lead_id) {
    return { name: hub.applicant_name ?? "", email: hub.applicant_email ?? "", phone: hub.applicant_whatsapp ?? "" };
  }
  const { data: lead } = await admin()
    .from("leads")
    .select("id, form_submissions(data, forms(schema))")
    .eq("id", hub.lead_id)
    .maybeSingle();
  const submission = lead?.form_submissions as unknown as
    | { data: Record<string, unknown>; forms: { schema: unknown } }
    | null;
  if (!submission) return { name: "", email: "", phone: "" };
  return resolveSubmissionIdentity(submission.data, extractFields(submission.forms.schema));
}
