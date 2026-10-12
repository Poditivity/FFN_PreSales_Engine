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
  return nodes.filter((n) => n.type === "question" && n.data.field).map((n) => n.data.field as FormField);
}

// ---- Runtime traversal ------------------------------------------------------

export function matchesOption(answer: unknown, value: unknown): boolean {
  if (Array.isArray(answer)) return answer.map(String).includes(String(value));
  return String(answer ?? "") === String(value ?? "");
}

export function getNode(nodes: FlowNode[], id: string | null): FlowNode | null {
  return nodes.find((n) => n.id === id) ?? null;
}

export function outgoingEdges(edges: FlowEdgeModel[], nodeId: string): FlowEdgeModel[] {
  return edges.filter((e) => e.source === nodeId);
}

/** Given the current node + its answer, return the next node id (or null = finish). */
export function nextNodeId(node: FlowNode, answer: unknown, edges: FlowEdgeModel[]): string | null {
  const outs = outgoingEdges(edges, node.id);
  if (outs.length === 0) return null;

  const field = node.data.field;
  if (field && isChoiceField(field.type)) {
    const optionEdge = outs.find((e) => e.data.kind === "option" && matchesOption(answer, e.data.value));
    if (optionEdge) return optionEdge.target;
    const elseEdge = outs.find((e) => e.data.kind === "else");
    if (elseEdge) return elseEdge.target;
    const always = outs.find((e) => e.data.kind === "always");
    return always ? always.target : null;
  }
  return outs[0].target;
}

/** Entry node = target of the start node's edge (fallback: first question node). */
export function entryNodeId(nodes: FlowNode[], edges: FlowEdgeModel[]): string | null {
  const startEdge = edges.find((e) => e.source === "start");
  if (startEdge) return startEdge.target;
  const firstQ = nodes.find((n) => n.type === "question");
  return firstQ?.id ?? null;
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
    if (outs.length === 0) {
      best = Math.max(best, depth + 1);
      return;
    }
    const nextSeen = new Set(seen).add(id);
    outs.forEach((e) => dfs(e.target, depth + 1, nextSeen));
  };
  dfs(entry, 0, new Set());
  return Math.max(1, best);
}

export { fieldNeedsOptions, isInputField };
