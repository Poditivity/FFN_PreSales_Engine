import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEdge, makeEndNode, makeQuestionNode, makeStartNode, serializeGraph, type FlowNode } from "@/lib/forms/flowModel";
import type { Form } from "@/lib/forms/schema";
import { normalizePublicSettings } from "@/lib/forms/consent";

const flush = vi.fn();
const setData = vi.fn();
const uploadFormFile = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ functions: { invoke: () => Promise.resolve({}) } }),
}));
vi.mock("@/lib/forms/analytics", () => ({ trackFormStart: vi.fn(), trackFormComplete: vi.fn(), trackFormDrop: vi.fn() }));
vi.mock("@/lib/forms/fileUpload", () => ({ uploadFormFile: (...args: unknown[]) => uploadFormFile(...args) }));
vi.mock("@/lib/forms/useFormSubmission", () => ({
  useFormSubmission: () => ({
    sessionId: "session-1",
    onFieldFocus: vi.fn(),
    onFieldBlur: vi.fn(),
    onKeystroke: vi.fn(),
    setData,
    flush,
    markCompleted: vi.fn(),
    timeOnFormSeconds: () => 3,
  }),
}));

import { FormRenderer } from "./FormRenderer";

const FORM_ID = "11111111-1111-1111-1111-111111111111";

function formWith(questions: FlowNode[]): Form {
  const start = makeStartNode();
  const end = makeEndNode({ x: 0, y: 0 });
  const edges = [];
  let prev = "start";
  for (const q of questions) {
    edges.push(makeEdge(prev, q.id, { kind: "always" }));
    prev = q.id;
  }
  edges.push(makeEdge(prev, end.id, { kind: "always" }));
  return {
    id: FORM_ID,
    title: "Apply",
    slug: "apply",
    status: "active",
    schema: serializeGraph([start, ...questions, end], edges),
    description: null,
    thank_you_message: "Thanks",
    post_submit_action: "message",
    redirect_url: null,
  };
}

const emailQuestion = () => {
  const q = makeQuestionNode("email", { x: 0, y: 0 });
  q.data.field = { ...q.data.field!, label: "Email", required: true };
  return q;
};

const settings = normalizePublicSettings({ privacy_policy_text: "We keep your details safe.", privacy_policy_url: "https://ffn.example/privacy" });

describe("FormRenderer: email, consent and files", () => {
  beforeEach(() => {
    flush.mockReset().mockResolvedValue("submission-1");
    setData.mockReset();
    uploadFormFile.mockReset();
  });

  it("refuses an invalid email on Submit and says why, without sending anything", async () => {
    const q = emailQuestion();
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { value: "ada@@example" } });
    fireEvent.click(screen.getByLabelText("I agree to the privacy policy"));
    fireEvent.click(screen.getByTestId("submit-button"));
    expect((await screen.findAllByText("Enter a valid email address")).length).toBeGreaterThan(0);
    expect(flush).not.toHaveBeenCalled();
  });

  it("checks the email as soon as the applicant leaves the field", async () => {
    const q = emailQuestion();
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    const input = screen.getByTestId(`field-${q.id}`);
    fireEvent.change(input, { target: { value: "ada@example" } });
    fireEvent.blur(input);
    expect((await screen.findAllByText("Enter a valid email address")).length).toBeGreaterThan(0);
  });

  it("does not nag about an empty required field on blur", () => {
    const q = emailQuestion();
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    fireEvent.blur(screen.getByTestId(`field-${q.id}`));
    expect(screen.queryByText("This field is required")).toBeNull();
  });

  it("shows the privacy notice, the policy link and the consent box on the last question", () => {
    render(<FormRenderer form={formWith([emailQuestion()])} settings={settings} />);
    expect(screen.getByText("We keep your details safe.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Read the full privacy policy/ });
    expect(link).toHaveAttribute("href", "https://ffn.example/privacy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("I agree to the privacy policy")).not.toBeChecked();
  });

  it("uses the standard notice and no link when the team has set none", () => {
    render(<FormRenderer form={formWith([emailQuestion()])} />);
    expect(screen.getByText(/will store and use the details you give in this form/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /privacy policy/ })).toBeNull();
  });

  it("holds the form until the consent box is ticked", async () => {
    const q = emailQuestion();
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(await screen.findByText("Agree to the privacy policy to submit.")).toBeInTheDocument();
    expect(flush).not.toHaveBeenCalled();
  });

  it("submits once ticked, and keeps the consent with the answers", async () => {
    const q = emailQuestion();
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByLabelText("I agree to the privacy policy"));
    fireEvent.click(screen.getByTestId("submit-button"));
    await waitFor(() => expect(flush).toHaveBeenCalledWith({ partial: false, completed: true }));
    const saved = setData.mock.calls.at(-1)![0];
    expect(saved[q.id]).toBe("ada@example.com");
    expect(saved.__consent).toMatchObject({ accepted: true, policy_url: "https://ffn.example/privacy" });
    expect(await screen.findByTestId("submission-confirmation")).toHaveTextContent("Thanks");
  });

  it("asks for consent only on the last question", () => {
    const first = emailQuestion();
    const second = makeQuestionNode("text", { x: 0, y: 0 });
    render(<FormRenderer form={formWith([first, second])} settings={settings} />);
    expect(screen.queryByTestId("privacy-consent")).toBeNull();
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Next");
  });

  it("does not ask for consent on a branching question before it is answered", async () => {
    const start = makeStartNode();
    const branch = makeQuestionNode("radio", { x: 0, y: 0 });
    branch.data.field = { ...branch.data.field!, label: "Pick one", options: ["More", "Done"], required: true };
    const last = makeQuestionNode("text", { x: 0, y: 0 });
    const end = makeEndNode({ x: 0, y: 0 });
    // "More" leads to one more question, anything else goes straight to the end.
    const edges = [
      makeEdge("start", branch.id, { kind: "always" }),
      makeEdge(branch.id, last.id, { kind: "option", value: "More" }),
      makeEdge(branch.id, end.id, { kind: "else" }),
      makeEdge(last.id, end.id, { kind: "always" }),
    ];
    const form = { ...formWith([]), schema: serializeGraph([start, branch, last, end], edges) };
    render(<FormRenderer form={form} settings={settings} />);

    // Unanswered: nobody knows yet whether this is the last question.
    expect(screen.queryByTestId("privacy-consent")).toBeNull();
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Next");

    // The answer that continues keeps consent for the question after it.
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByTestId("privacy-consent")).toBeNull();
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Next");

    // The answer that ends the form brings consent in.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByTestId("privacy-consent")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Submit");
  });

  it("moves on when Enter submits the question form", async () => {
    const first = emailQuestion();
    const second = makeQuestionNode("text", { x: 0, y: 0 });
    render(<FormRenderer form={formWith([first, second])} settings={settings} />);
    const input = screen.getByTestId(`field-${first.id}`);
    fireEvent.change(input, { target: { value: "ada@example.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByTestId(`field-${second.id}`)).toBeInTheDocument();
  });

  it("uploads a file question's file and keeps its link as the answer", async () => {
    const q = makeQuestionNode("file", { x: 0, y: 0 });
    uploadFormFile.mockResolvedValue("https://files.example.com/forms/x/y.pdf");
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    const file = new File([new Uint8Array(10)], "deck.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId(`file-name-${q.id}`)).toHaveTextContent("deck.pdf"));
    expect(uploadFormFile).toHaveBeenCalledWith(
      expect.objectContaining({ formId: FORM_ID, fieldId: q.id, sessionId: "session-1", config: { categories: ["images", "pdf"], maxMb: 5 } }),
    );
    fireEvent.click(screen.getByLabelText("I agree to the privacy policy"));
    fireEvent.click(screen.getByTestId("submit-button"));
    await waitFor(() => expect(flush).toHaveBeenCalled());
    expect(setData.mock.calls.at(-1)![0][q.id]).toBe("https://files.example.com/forms/x/y.pdf");
  });

  it("refuses a file the question does not accept before uploading it", async () => {
    const q = makeQuestionNode("file", { x: 0, y: 0 });
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    const file = new File([new Uint8Array(10)], "run.exe", { type: "application/x-msdownload" });
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { files: [file] } });
    expect(await screen.findByText(/not accepted here/)).toBeInTheDocument();
    expect(uploadFormFile).not.toHaveBeenCalled();
  });

  it("shows the server's reason when an upload fails", async () => {
    const q = makeQuestionNode("file", { x: 0, y: 0 });
    uploadFormFile.mockRejectedValue(new Error("Too many uploads. Try again in a little while."));
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    const file = new File([new Uint8Array(10)], "a.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { files: [file] } });
    expect(await screen.findByText("Too many uploads. Try again in a little while.")).toBeInTheDocument();
  });

  it("holds the file question to the limit set on the question", async () => {
    const q = makeQuestionNode("file", { x: 0, y: 0 });
    q.data.field = { ...q.data.field!, fileConfig: { categories: ["pdf"], maxMb: 2 } };
    render(<FormRenderer form={formWith([q])} settings={settings} />);
    expect(screen.getByText(/Up to 2 MB/)).toBeInTheDocument();
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { files: [big] } });
    expect(await screen.findByText(/over 2 MB/)).toBeInTheDocument();
    expect(uploadFormFile).not.toHaveBeenCalled();
  });
});
