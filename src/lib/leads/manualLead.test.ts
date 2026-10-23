import { describe, expect, it } from "vitest";
import { makeEdge, makeEndNode, makeQuestionNode, makeStartNode, serializeGraph } from "@/lib/forms/flowModel";
import { answerProblems, pickAnswers, questionsFor, routeProblems } from "./manualLead";

function branching() {
  const start = makeStartNode();
  const choice = makeQuestionNode("radio", { x: 0, y: 0 });
  choice.data.field = { ...choice.data.field!, label: "Stage", options: ["Idea", "Revenue"], required: true };
  const idea = makeQuestionNode("text", { x: 0, y: 0 });
  const revenue = makeQuestionNode("number", { x: 0, y: 0 });
  const note = makeQuestionNode("text_block", { x: 0, y: 0 });
  const end = makeEndNode({ x: 0, y: 0 });
  const edges = [
    makeEdge("start", choice.id),
    makeEdge(choice.id, note.id, { kind: "option", value: "Idea" }),
    makeEdge(note.id, idea.id),
    makeEdge(choice.id, revenue.id, { kind: "option", value: "Revenue" }),
    makeEdge(idea.id, end.id),
    makeEdge(revenue.id, end.id),
  ];
  return { schema: serializeGraph([start, choice, note, idea, revenue, end], edges), choice, idea, revenue };
}

describe("questionsFor", () => {
  it("stops at a choice question that has no answer yet", () => {
    const { schema, choice } = branching();
    expect(questionsFor(schema, {}).map((f) => f.id)).toEqual([choice.id]);
  });

  it("follows the branch the answer picks and skips text boxes", () => {
    const { schema, choice, idea, revenue } = branching();
    expect(questionsFor(schema, { [choice.id]: "Idea" }).map((f) => f.id)).toEqual([choice.id, idea.id]);
    expect(questionsFor(schema, { [choice.id]: "Revenue" }).map((f) => f.id)).toEqual([choice.id, revenue.id]);
  });
});

describe("answerProblems and pickAnswers", () => {
  it("flags a required question left empty", () => {
    const { schema, choice } = branching();
    const fields = questionsFor(schema, {});
    expect(answerProblems(fields, {})).toEqual({ [choice.id]: "This field is required" });
  });

  it("keeps only answers to questions that were asked", () => {
    const { schema, choice, idea, revenue } = branching();
    const answers = { [choice.id]: "Idea", [idea.id]: "An app", [revenue.id]: "100" };
    expect(pickAnswers(questionsFor(schema, answers), answers)).toEqual({ [choice.id]: "Idea", [idea.id]: "An app" });
  });
});

describe("routeProblems", () => {
  it("flags an answer the form has no next step for, instead of ending the list there", () => {
    const { schema, choice } = branching();
    choice.data.field = { ...choice.data.field!, options: ["Idea", "Revenue", "Exited"] };
    expect(routeProblems(schema, { [choice.id]: "Idea" })).toEqual({});
    expect(Object.keys(routeProblems(schema, { [choice.id]: "Exited" }))).toEqual([choice.id]);
  });
});
