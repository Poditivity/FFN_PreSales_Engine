// Ported from build-fellowship's app/src/lib/flowModel.js — the node/edge
// graph that drives the one-question-at-a-time public flow and the visual
// admin builder. isFieldVisible/getVisibleFields/evaluateRouting from the
// source's formLogic.js are NOT ported: grepping build-fellowship's app
// showed they are dead code (defined, never called) now that branching is
// expressed as graph edges instead.

import { fieldNeedsOptions, isInputField, makeField, type FieldType, type FormField } from "./formLogic";

export const CHOICE_TYPES: FieldType[] = ["select", "radio", "multiselect"];
export const isChoiceField = (type: FieldType) => CHOICE_TYPES.includes(type);

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export type NodeKind = "start" | "question" | "end";

export interface FlowPosition {
  x: number;
  y: number;
}

export interface EndNodeData {
  label: string;
  message: string;
  redirect_url: string;
}

export interface FlowNode {
  id: string;
  type: NodeKind;
  position: FlowPosition;
  data: { field?: FormField } & Partial<EndNodeData>;
  deletable?: boolean;
}

export type EdgeKind = "always" | "option" | "else";

export interface EdgeData {
  kind: EdgeKind;
  value?: string;
  [key: string]: unknown;
}

export interface FlowEdgeModel {
  id: string;
  source: string;
  target: string;
  type: "flow";
  data: EdgeData;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  selected?: boolean;
  [key: string]: unknown;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdgeModel[];
  startNodeId: "start";
}

// ---- Node/edge factories ---------------------------------------------------

export function makeStartNode(position: FlowPosition = { x: 80, y: 40 }): FlowNode {
  return { id: "start", type: "start", position, data: {}, deletable: false };
}

export function makeQuestionNode(fieldType: FieldType, position: FlowPosition): FlowNode {
  const field = makeField(fieldType);
  return { id: field.id, type: "question", position, data: { field } };
}

export function makeEndNode(position: FlowPosition, data: Partial<EndNodeData> = {}): FlowNode {
  return {
    id: uid("end"),
    type: "end",
    position,
    data: { label: "Finish", message: "", redirect_url: "", ...data },
  };
}

// Edge "kinds":
//  - always : unconditional (non-choice questions, start)
//  - option : taken when the source choice answer equals this value
//  - else   : fallback when no option matched
export function makeEdge(source: string, target: string, data: EdgeData = { kind: "always" }): FlowEdgeModel {
  return { id: uid("e"), source, target, type: "flow", data };
}

// ---- Normalization (handles old flat schema + graph schema) ---------------

export function normalizeSchema(schema: unknown): FlowGraph {
  if (schema && typeof schema === "object" && !Array.isArray(schema) && Array.isArray((schema as { nodes?: unknown }).nodes)) {
    const s = schema as { nodes: FlowNode[]; edges?: FlowEdgeModel[] };
    const hasStart = s.nodes.some((n) => n.type === "start");
    const nodes = hasStart ? s.nodes : [makeStartNode(), ...s.nodes];
    return {
      nodes: nodes.map((n) => (n.type === "start" ? { ...n, deletable: false } : n)),
      edges: s.edges ?? [],
      startNodeId: "start",
    };
  }

  // Old flat array of fields → convert to a vertical chain.
  const fields = Array.isArray(schema) ? (schema as FormField[]).filter((f) => isInputField(f.type)) : [];
  const nodes: FlowNode[] = [makeStartNode({ x: 80, y: 40 })];
  const edges: FlowEdgeModel[] = [];
  let prevId = "start";
  fields.forEach((f, i) => {
    const node: FlowNode = { id: f.id, type: "question", position: { x: 80, y: 160 + i * 150 }, data: { field: f } };
    nodes.push(node);
    edges.push(makeEdge(prevId, node.id, { kind: "always" }));
    prevId = node.id;
  });
  const end = makeEndNode({ x: 80, y: 160 + fields.length * 150 });
  nodes.push(end);
  edges.push(makeEdge(prevId, end.id, { kind: "always" }));
  return { nodes, edges, startNodeId: "start" };
}

export function serializeGraph(nodes: FlowNode[], edges: FlowEdgeModel[]) {
  return { version: 2, nodes, edges, startNodeId: "start" as const };
}

/** Pull all question fields out of any schema shape, in raw node order. */
export function extractFields(schema: unknown): FormField[] {
  const { nodes } = normalizeSchema(schema);
  return nodes
    .filter((n) => n.type === "question" && n.data.field && isInputField(n.data.field.type))
    .map((n) => n.data.field as FormField);
}

// ---- Runtime traversal ------------------------------------------------------

/** Option text as branches compare it: case and surrounding spaces don't matter. */
export function normalizeOption(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function matchesOption(answer: unknown, value: unknown): boolean {
  const target = normalizeOption(value);
  if (Array.isArray(answer)) return answer.some((a) => normalizeOption(a) === target);
  return normalizeOption(answer) === target;
}

export function getNode(nodes: FlowNode[], id: string | null): FlowNode | null {
  return nodes.find((n) => n.id === id) ?? null;
}

export function outgoingEdges(edges: FlowEdgeModel[], nodeId: string): FlowEdgeModel[] {
  return edges.filter((e) => e.source === nodeId);
}

/**
 * nextNodeId's result when a choice question is answered but no branch matches the answer
 * and the question has no "any other answer" branch. The flow cannot go on, and it must not
 * be treated as the end of the form: that would save a finished submission with every later
 * answer missing.
 */
export const UNROUTED = Symbol("unrouted");

function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/** Given the current node + its answer, return the next node id (null = finish, UNROUTED = stuck). */
export function nextNodeId(node: FlowNode, answer: unknown, edges: FlowEdgeModel[]): string | null | typeof UNROUTED {
  const outs = outgoingEdges(edges, node.id);
  if (outs.length === 0) return null;

  const field = node.data.field;
  if (field && isChoiceField(field.type)) {
    const optionEdge = outs.find((e) => e.data.kind === "option" && matchesOption(answer, e.data.value));
    if (optionEdge) return optionEdge.target;
    const elseEdge = outs.find((e) => e.data.kind === "else");
    if (elseEdge) return elseEdge.target;
    const always = outs.find((e) => e.data.kind === "always");
    if (always) return always.target;
    // A skipped optional question still ends the flow, as before.
    return hasAnswer(answer) ? UNROUTED : null;
  }
  return outs[0].target;
}

// ---- Keeping branches in step with options (builder) ------------------------

/**
 * Edges after a choice question's options change from `before` to `after`. A renamed option
 * takes its branch with it; a removed option's branch is removed.
 */
export function syncOptionEdges(edges: FlowEdgeModel[], nodeId: string, before: string[], after: string[]): FlowEdgeModel[] {
  const isOwnOption = (e: FlowEdgeModel) => e.source === nodeId && e.data.kind === "option";
  if (before.length === after.length) {
    let next = edges;
    before.forEach((old, idx) => {
      const renamed = after[idx];
      if (old === renamed) return;
      // When another option still has the old text, the branch belongs to that one.
      if (after.some((o, j) => j !== idx && normalizeOption(o) === normalizeOption(old))) return;
      next = next.map((e) =>
        isOwnOption(e) && normalizeOption(e.data.value) === normalizeOption(old)
          ? { ...e, sourceHandle: `opt:${renamed}`, data: { ...e.data, value: renamed } }
          : e,
      );
    });
    return next;
  }
  return edges.filter((e) => !isOwnOption(e) || after.some((o) => matchesOption(o, e.data.value)));
}

/** One line per branch that points at an option its question no longer has. Empty when all is well. */
export function brokenBranches(nodes: FlowNode[], edges: FlowEdgeModel[]): string[] {
  const problems: string[] = [];
  for (const e of edges) {
    if (e.data.kind !== "option") continue;
    const field = getNode(nodes, e.source)?.data.field;
    if (!field) continue;
    if ((field.options ?? []).some((o) => matchesOption(o, e.data.value))) continue;
    problems.push(
      `"${field.label.trim() || "Untitled question"}" has a branch for "${e.data.value ?? ""}", which is not one of its options. ` +
        `Add the option "${e.data.value ?? ""}" back, then delete or redraw that branch.`,
    );
  }
  return problems;
}

/** Entry node = target of the start node's edge (fallback: first question node). */
export function entryNodeId(nodes: FlowNode[], edges: FlowEdgeModel[]): string | null {
  const startEdge = edges.find((e) => e.source === "start");
  if (startEdge) return startEdge.target;
  const firstQ = nodes.find((n) => n.type === "question");
  return firstQ?.id ?? null;
}

const isSectionNode = (node: FlowNode | null) => node?.type === "question" && node.data.field?.type === "section_header";

/**
 * A section heading is shown above the question that follows it, on the same page, so it is
 * never a step of its own. A section with nothing to attach to (it leads straight to the end)
 * still is.
 */
function isAttachedSection(nodes: FlowNode[], edges: FlowEdgeModel[], node: FlowNode | null): boolean {
  if (!node || !isSectionNode(node)) return false;
  const next = outgoingEdges(edges, node.id)[0];
  return getNode(nodes, next?.target ?? null)?.type === "question";
}

/**
 * Where to land when moving to a node: past any section headings that sit directly before a
 * question, which are returned to be shown above it.
 */
export function resolveStep(
  nodes: FlowNode[],
  edges: FlowEdgeModel[],
  startId: string | null,
): { id: string | null; sections: FormField[] } {
  const sections: FormField[] = [];
  const seen = new Set<string>();
  let id = startId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = getNode(nodes, id);
    if (!node || !isAttachedSection(nodes, edges, node)) break;
    sections.push(node.data.field as FormField);
    // A section is never a choice question, so it is never left without a route.
    const next = nextNodeId(node, undefined, edges);
    id = next === UNROUTED ? null : next;
  }
  return { id, sections };
}

/** Longest path (in question-steps) from entry to any end — used for progress. */
export function estimateSteps(nodes: FlowNode[], edges: FlowEdgeModel[]): number {
  const entry = entryNodeId(nodes, edges);
  if (!entry) return 1;
  let best = 1;
  const dfs = (id: string | null, depth: number, seen: Set<string>) => {
    if (!id || seen.has(id)) {
      best = Math.max(best, depth);
      return;
    }
    const node = getNode(nodes, id);
    if (!node || node.type === "end") {
      best = Math.max(best, depth);
      return;
    }
    const outs = outgoingEdges(edges, id);
    // A section shown with the next question adds no step of its own.
    const step = isAttachedSection(nodes, edges, node) ? 0 : 1;
    if (outs.length === 0) {
      best = Math.max(best, depth + step);
      return;
    }
    const nextSeen = new Set(seen).add(id);
    outs.forEach((e) => dfs(e.target, depth + step, nextSeen));
  };
  dfs(entry, 0, new Set());
  return Math.max(1, best);
}

export { fieldNeedsOptions, isInputField };
