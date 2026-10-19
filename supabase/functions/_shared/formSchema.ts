// Reads the question fields out of a form's stored schema. The schema is a
// node/edge graph (question nodes carry their field in data.field) or, on older
// forms, a flat list of fields. Mirrors extractFields in src/lib/forms/flowModel.ts.

export interface SchemaQuestion {
  id: string;
  label: string;
  type: string;
}

/** Steps that only show something to the applicant and collect no answer. */
export const DISPLAY_FIELD_TYPES = ["section_header", "text_block"];

export function schemaFields(schema: unknown): SchemaQuestion[] {
  if (Array.isArray(schema)) return (schema as SchemaQuestion[]).filter((f) => f && typeof f === "object" && !DISPLAY_FIELD_TYPES.includes(f.type));
  if (!schema || typeof schema !== "object") return [];
  const nodes = (schema as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n) => (n as { type?: string })?.type === "question")
    .map((n) => (n as { data?: { field?: SchemaQuestion } }).data?.field)
    .filter((f): f is SchemaQuestion => !!f && !DISPLAY_FIELD_TYPES.includes(f.type));
}
