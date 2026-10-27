import { describe, expect, it } from "vitest";
import { flowOrderedFields } from "./formSchema.ts";

const q = (id: string, type = "text") => ({ id, type: "question", data: { field: { id, label: id, type } } });
const edges = (...pairs: [string, string][]) => pairs.map(([source, target]) => ({ source, target }));
const ids = (schema: unknown) => flowOrderedFields(schema).map((f) => f.id);

describe("flowOrderedFields", () => {
  it("follows the flow, not the order the nodes were saved in", () => {
    const schema = {
      nodes: [{ id: "start", type: "start" }, q("startup"), q("problem"), q("name"), q("email", "email"), { id: "end", type: "end" }],
      edges: edges(["start", "name"], ["name", "email"], ["email", "startup"], ["startup", "problem"], ["problem", "end"]),
    };
    expect(ids(schema)).toEqual(["name", "email", "startup", "problem"]);
  });

  it("puts a question that branches rejoin after every branch, and keeps branch order", () => {
    const schema = {
      nodes: [{ id: "start", type: "start" }, q("a"), q("left"), q("right"), q("join"), { id: "end", type: "end" }],
      edges: edges(["start", "a"], ["a", "left"], ["a", "right"], ["left", "join"], ["right", "join"], ["join", "end"]),
    };
    expect(ids(schema)).toEqual(["a", "left", "right", "join"]);
  });

  it("appends questions the flow never reaches, in saved order", () => {
    const schema = {
      nodes: [{ id: "start", type: "start" }, q("orphan"), q("a"), q("b")],
      edges: edges(["start", "a"], ["a", "b"]),
    };
    expect(ids(schema)).toEqual(["a", "b", "orphan"]);
  });

  it("survives a loop in the flow", () => {
    const schema = { nodes: [{ id: "start", type: "start" }, q("a"), q("b")], edges: edges(["start", "a"], ["a", "b"], ["b", "a"]) };
    expect(ids(schema)).toEqual(["a", "b"]);
  });

  it("leaves out section headings and text blocks", () => {
    const schema = {
      nodes: [{ id: "start", type: "start" }, q("intro", "section_header"), q("a")],
      edges: edges(["start", "intro"], ["intro", "a"]),
    };
    expect(ids(schema)).toEqual(["a"]);
  });

  it("falls back to saved order without edges, and reads an old flat list as it is", () => {
    expect(ids({ nodes: [q("b"), q("a")] })).toEqual(["b", "a"]);
    expect(ids([{ id: "x", label: "x", type: "text" }, { id: "y", label: "y", type: "text" }])).toEqual(["x", "y"]);
    expect(ids(null)).toEqual([]);
  });
});
