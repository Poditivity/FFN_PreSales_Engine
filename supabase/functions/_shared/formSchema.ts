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

/**
 * The questions in the order an applicant meets them: the flow from the start node, following
 * the schema's edges. schemaFields lists them in the order the builder saved the nodes, which
 * differs once a question has been added or moved after the others were wired up. Branches keep
 * their edge order and a question several branches lead to comes after all of them. Questions
 * the flow never reaches go last, in saved order.
 */
export function flowOrderedFields(schema: unknown): SchemaQuestion[] {
  const saved = schemaFields(schema);
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return saved;
  const { nodes, edges } = schema as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return saved;

  const next = new Map<string, string[]>();
  for (const e of edges as { source?: string; target?: string }[]) {
    if (!e?.source || !e.target) continue;
    next.set(e.source, [...(next.get(e.source) ?? []), e.target]);
  }
  const entry = next.get("start")?.[0];
  if (!entry) return saved;

  // Reverse post-order of a depth-first walk: every question lands after the ones that lead to it.
  const seen = new Set<string>();
  const visited: string[] = [];
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    // Walked last-edge-first so the first branch ends up first once the order is reversed.
    for (const target of [...(next.get(id) ?? [])].reverse()) walk(target);
    visited.push(id);
  };
  walk(entry);

  const byNode = new Map<string, SchemaQuestion>();
  for (const n of nodes as { id?: string; type?: string; data?: { field?: SchemaQuestion } }[]) {
    const field = n?.data?.field;
    if (n?.id && n.type === "question" && field && !DISPLAY_FIELD_TYPES.includes(field.type)) byNode.set(n.id, field);
  }
  const ordered = visited
    .reverse()
    .map((id) => byNode.get(id))
    .filter((f): f is SchemaQuestion => !!f);
  return [...ordered, ...saved.filter((f) => !ordered.includes(f))];
}
