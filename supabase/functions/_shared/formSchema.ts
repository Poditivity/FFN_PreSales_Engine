// Reads the question fields out of a form's stored schema. The schema is a
// node/edge graph (question nodes carry their field in data.field) or, on older
// forms, a flat list of fields. Mirrors extractFields in src/lib/forms/flowModel.ts.

export interface SchemaQuestion {
  id: string;
  label: string;
  type: string;
}

export function schemaFields(schema: unknown): SchemaQuestion[] {
  if (Array.isArray(schema)) return (schema as SchemaQuestion[]).filter((f) => f && typeof f === "object" && f.type !== "section_header");
  if (!schema || typeof schema !== "object") return [];
  const nodes = (schema as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n) => (n as { type?: string })?.type === "question")
    .map((n) => (n as { data?: { field?: SchemaQuestion } }).data?.field)
    .filter((f): f is SchemaQuestion => !!f);
}
