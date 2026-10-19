import { entryNodeId, getNode, isChoiceField, nextNodeId, normalizeSchema } from "@/lib/forms/flowModel";
import { isInputField, validateField, type FormField } from "@/lib/forms/formLogic";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * The questions to ask for a manual lead on a given form: the ones an applicant would
 * meet, following the form's branches by the answers given so far. A choice question
 * that has no answer yet ends the list, because nobody knows where it leads.
 */
export function questionsFor(schema: unknown, answers: Record<string, unknown>): FormField[] {
  const { nodes, edges } = normalizeSchema(schema);
  const fields: FormField[] = [];
  const seen = new Set<string>();
  let id = entryNodeId(nodes, edges);
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = getNode(nodes, id);
    if (!node || node.type === "end") break;
    const field = node.data.field;
    if (field && isInputField(field.type)) {
      fields.push(field);
      const answer = answers[field.id];
      const unanswered = Array.isArray(answer) ? answer.length === 0 : answer === undefined || answer === null || answer === "";
      if (isChoiceField(field.type) && unanswered) break;
    }
    id = nextNodeId(node, answers[field?.id ?? ""], edges);
  }
  return fields;
}

/** Each question's problem, by field id. Empty when every answer is acceptable. */
export function answerProblems(fields: FormField[], answers: Record<string, unknown>): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const field of fields) {
    const problem = validateField(field, answers[field.id]);
    if (problem) problems[field.id] = problem;
  }
  return problems;
}

/** Only answers to questions that were asked are kept, so a changed branch leaves nothing behind. */
export function pickAnswers(fields: FormField[], answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = answers[field.id];
    if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) out[field.id] = value;
  }
  return out;
}

/** The "Manual entry" form's questions, used when no form is chosen. Ids match the migration. */
export const MANUAL_ENTRY_FIELDS: FormField[] = [
  { id: "manual_name", type: "name", label: "Full name", placeholder: "", required: true, helpText: "", width: "full", validation: {}, showIf: null },
  { id: "manual_email", type: "email", label: "Email", placeholder: "", required: true, helpText: "", width: "full", validation: {}, showIf: null },
  { id: "manual_phone", type: "phone", label: "Phone", placeholder: "", required: false, helpText: "", width: "full", validation: {}, showIf: null },
  { id: "manual_notes", type: "textarea", label: "Notes", placeholder: "", required: false, helpText: "", width: "full", validation: {}, showIf: null },
];

/** Adds the lead and resolves to its id. A blank formId means the "Manual entry" form. */
export async function createManualLead(formId: string, data: Record<string, unknown>): Promise<{ id: string | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient();
  const { data: id, error } = await supabase.rpc("admin_create_manual_lead", { p_form_id: formId || null, p_data: data });
  if (error) return { id: null, error: error.message };
  return { id: (id as string | null) ?? null, error: null };
}
