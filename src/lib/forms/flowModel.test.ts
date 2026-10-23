import { describe, expect, it } from "vitest";
import {
  brokenBranches,
  entryNodeId,
  estimateSteps,
  makeEdge,
  makeEndNode,
  makeQuestionNode,
  makeStartNode,
  nextNodeId,
  normalizeSchema,
  syncOptionEdges,
  UNROUTED,
} from "./flowModel";
import { makeField } from "./formLogic";

describe("flowModel — branching", () => {
  it("routes a choice answer to the edge matching its option value", () => {
    const choice = makeQuestionNode("radio", { x: 0, y: 0 });
    choice.data.field = { ...makeField("radio"), id: choice.id, options: ["Yes", "No"] };
    const yesEnd = makeEndNode({ x: 0, y: 0 });
    const noEnd = makeEndNode({ x: 0, y: 0 });
    const edges = [
      makeEdge("start", choice.id, { kind: "always" }),
      makeEdge(choice.id, yesEnd.id, { kind: "option", value: "Yes" }),
      makeEdge(choice.id, noEnd.id, { kind: "option", value: "No" }),
    ];

    expect(nextNodeId(choice, "Yes", edges)).toBe(yesEnd.id);
    expect(nextNodeId(choice, "No", edges)).toBe(noEnd.id);
  });

  it("falls back to the else edge when no option matches", () => {
    const choice = makeQuestionNode("select", { x: 0, y: 0 });
    choice.data.field = { ...makeField("select"), id: choice.id, options: ["A", "B"] };
    const matched = makeEndNode({ x: 0, y: 0 });
    const fallback = makeEndNode({ x: 0, y: 0 });
    const edges = [
      makeEdge(choice.id, matched.id, { kind: "option", value: "A" }),
      makeEdge(choice.id, fallback.id, { kind: "else" }),
    ];

    expect(nextNodeId(choice, "Something else entirely", edges)).toBe(fallback.id);
  });

  it("takes the single outgoing edge for a non-choice question", () => {
    const q = makeQuestionNode("text", { x: 0, y: 0 });
    const end = makeEndNode({ x: 0, y: 0 });
    const edges = [makeEdge(q.id, end.id, { kind: "always" })];

    expect(nextNodeId(q, "anything", edges)).toBe(end.id);
  });

  it("matches an option ignoring case and surrounding spaces", () => {
    const choice = makeQuestionNode("multiselect", { x: 0, y: 0 });
    choice.data.field = { ...makeField("multiselect"), id: choice.id, options: ["Yes", "No"] };
    const yesEnd = makeEndNode({ x: 0, y: 0 });
    const edges = [makeEdge(choice.id, yesEnd.id, { kind: "option", value: "Yes " })];

    expect(nextNodeId(choice, " yes", edges)).toBe(yesEnd.id);
    expect(nextNodeId(choice, ["No", "YES"], edges)).toBe(yesEnd.id);
  });

  it("never treats an answer with no branch and no fallback as the end of the form", () => {
    const choice = makeQuestionNode("radio", { x: 0, y: 0 });
    choice.data.field = { ...makeField("radio"), id: choice.id, options: ["Yes, I have a Partner", "No"] };
    const next = makeQuestionNode("text", { x: 0, y: 0 });
    const edges = [
      makeEdge(choice.id, next.id, { kind: "option", value: "Yes" }),
      makeEdge(choice.id, next.id, { kind: "option", value: "No" }),
    ];

    expect(nextNodeId(choice, "Yes, I have a Partner", edges)).toBe(UNROUTED);
    // A skipped optional question still ends the flow, as before.
    expect(nextNodeId(choice, undefined, edges)).toBeNull();
  });

  it("returns null (finish) when a node has no outgoing edges", () => {
    const q = makeQuestionNode("text", { x: 0, y: 0 });
    expect(nextNodeId(q, "anything", [])).toBeNull();
  });
});

describe("flowModel — normalizeSchema", () => {
  it("converts an old flat field array into a linear start->...->end chain", () => {
    const flat = [
      { ...makeField("text"), id: "a" },
      { ...makeField("email"), id: "b" },
    ];
    const graph = normalizeSchema(flat);

    expect(graph.nodes.find((n) => n.type === "start")).toBeTruthy();
    expect(graph.nodes.filter((n) => n.type === "question")).toHaveLength(2);
    expect(graph.nodes.find((n) => n.type === "end")).toBeTruthy();
    expect(entryNodeId(graph.nodes, graph.edges)).toBe("a");
  });

  it("passes a graph schema through unchanged (adding a start node only if missing)", () => {
    const q = makeQuestionNode("text", { x: 0, y: 0 });
    const end = makeEndNode({ x: 0, y: 0 });
    const schema = {
      nodes: [q, end],
      edges: [makeEdge(q.id, end.id, { kind: "always" })],
    };
    const graph = normalizeSchema(schema);
    expect(graph.nodes.some((n) => n.type === "start")).toBe(true);
    expect(graph.nodes).toHaveLength(3);
  });
});

describe("flowModel — estimateSteps", () => {
  it("counts the longest branch as the step total", () => {
    const start = makeStartNode();
    const q1 = makeQuestionNode("radio", { x: 0, y: 0 });
    q1.data.field = { ...makeField("radio"), id: q1.id, options: ["short", "long"] };
    const q2 = makeQuestionNode("text", { x: 0, y: 0 });
    const shortEnd = makeEndNode({ x: 0, y: 0 });
    const longEnd = makeEndNode({ x: 0, y: 0 });
    const edges = [
      makeEdge(start.id, q1.id, { kind: "always" }),
      makeEdge(q1.id, shortEnd.id, { kind: "option", value: "short" }),
      makeEdge(q1.id, q2.id, { kind: "option", value: "long" }),
      makeEdge(q2.id, longEnd.id, { kind: "always" }),
    ];
    const nodes = [start, q1, q2, shortEnd, longEnd];

    expect(estimateSteps(nodes, edges)).toBe(2);
  });
});

describe("sections share a page with the next question", () => {
  it("lands past a section and hands it back to show above the question", async () => {
    const { resolveStep, makeQuestionNode, makeEdge, makeEndNode, makeStartNode, estimateSteps } = await import("./flowModel");
    const start = makeStartNode();
    const sec = makeQuestionNode("section_header", { x: 0, y: 0 });
    const q = makeQuestionNode("text", { x: 0, y: 0 });
    const end = makeEndNode({ x: 0, y: 0 });
    const edges = [makeEdge("start", sec.id), makeEdge(sec.id, q.id), makeEdge(q.id, end.id)];
    const nodes = [start, sec, q, end];
    const step = resolveStep(nodes, edges, sec.id);
    expect(step.id).toBe(q.id);
    expect(step.sections.map((f) => f.id)).toEqual([sec.id]);
    // The section adds no page of its own, so the form is one step long.
    expect(estimateSteps(nodes, edges)).toBe(1);
  });
});

describe("flowModel — branches follow their options", () => {
  function yesNo() {
    const choice = makeQuestionNode("radio", { x: 0, y: 0 });
    choice.data.field = { ...makeField("radio"), id: choice.id, label: "Partner?", options: ["Yes", "No"] };
    const a = makeEndNode({ x: 0, y: 0 });
    const b = makeEndNode({ x: 0, y: 0 });
    const edges = [
      { ...makeEdge(choice.id, a.id, { kind: "option", value: "Yes" }), sourceHandle: "opt:Yes" },
      { ...makeEdge(choice.id, b.id, { kind: "option", value: "No" }), sourceHandle: "opt:No" },
    ];
    return { choice, nodes: [choice, a, b], edges };
  }

  it("renames the branch, value and handle, when its option is renamed", () => {
    const { choice, edges } = yesNo();
    const next = syncOptionEdges(edges, choice.id, ["Yes", "No"], ["Yes, I have a Partner", "No"]);
    expect(next[0].data.value).toBe("Yes, I have a Partner");
    expect(next[0].sourceHandle).toBe("opt:Yes, I have a Partner");
    expect(next[1]).toBe(edges[1]);
  });

  it("removes the branch when its option is removed", () => {
    const { choice, edges } = yesNo();
    expect(syncOptionEdges(edges, choice.id, ["Yes", "No"], ["No"]).map((e) => e.data.value)).toEqual(["No"]);
  });

  it("reports a branch whose option no longer exists", () => {
    const { choice, nodes, edges } = yesNo();
    expect(brokenBranches(nodes, edges)).toEqual([]);
    choice.data.field = { ...choice.data.field!, options: ["Yes, I have a Partner", " no "] };
    const problems = brokenBranches(nodes, edges);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"Partner?" has a branch for "Yes"');
  });
});
