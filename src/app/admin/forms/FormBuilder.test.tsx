import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const update = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      insert: (...a: unknown[]) => (insert(...a), { select: () => ({ single: async () => ({ data: { id: "f1" }, error: null }) }) }),
      update: (...a: unknown[]) => (update(...a), { eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { makeEdge, makeEndNode, makeQuestionNode, makeStartNode, serializeGraph } from "@/lib/forms/flowModel";
import { FormBuilder } from "./FormBuilder";

beforeEach(() => {
  insert.mockClear();
  update.mockClear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  window.DOMMatrixReadOnly ??= class { m22 = 1; constructor() {} } as unknown as typeof DOMMatrixReadOnly;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

describe("FormBuilder, new form", () => {
  it("does not save without a title, and saves once one is typed", async () => {
    render(<FormBuilder />);
    const title = screen.getByLabelText("Form title") as HTMLInputElement;
    expect(title.value).toBe("");
    expect(screen.getByText(/slug, description, thank you message and redirect url in\s+settings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/give the form a title/i)).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();

    fireEvent.change(title, { target: { value: "Apply" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
  });
});

describe("FormBuilder, saving", () => {
  it("tidies a typed slug and never sends a blank thank-you message", async () => {
    render(<FormBuilder />);
    fireEvent.change(screen.getByLabelText("Form title"), { target: { value: "Apply" } });
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: " Validation_Lab 2026! " } });
    fireEvent.change(screen.getByLabelText("Default thank-you message"), { target: { value: "   " } });
    fireEvent.click(screen.getAllByRole("button", { name: /^save$/i }).pop()!);
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const payload = insert.mock.calls[0][0];
    expect(payload.slug).toBe("validationlab-2026");
    expect(payload.thank_you_message).toBe("Thank you for applying! We will be in touch soon.");
  });
});

describe("FormBuilder, branches", () => {
  it("will not save a branch for an option that no longer exists", async () => {
    const choice = makeQuestionNode("radio", { x: 0, y: 0 });
    choice.data.field = { ...choice.data.field!, label: "Partner?", options: ["Yes, I have a Partner", "No"] };
    const end = makeEndNode({ x: 0, y: 0 });
    const schema = serializeGraph(
      [makeStartNode(), choice, end],
      [makeEdge("start", choice.id), { ...makeEdge(choice.id, end.id, { kind: "option", value: "Yes" }), sourceHandle: "opt:Yes" }],
    );
    render(
      <FormBuilder
        initialForm={{ id: "00000000-0000-4000-8000-000000000001", title: "Apply", slug: "apply", status: "draft", schema, post_submit_action: "message" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/"Partner\?" has a branch for "Yes"/)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});
