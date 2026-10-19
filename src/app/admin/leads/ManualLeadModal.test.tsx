import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEdge, makeEndNode, makeQuestionNode, makeStartNode, serializeGraph } from "@/lib/forms/flowModel";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc }) }));
vi.mock("@/lib/forms/fileUpload", () => ({ uploadFormFile: vi.fn() }));

import { ManualLeadModal } from "./ManualLeadModal";

function applyForm() {
  const start = makeStartNode();
  const q = makeQuestionNode("text", { x: 0, y: 0 });
  q.data.field = { ...q.data.field!, label: "Startup name", required: true };
  const end = makeEndNode({ x: 0, y: 0 });
  return {
    form: { id: "22222222-2222-2222-2222-222222222222", title: "Apply", schema: serializeGraph([start, q, end], [makeEdge("start", q.id), makeEdge(q.id, end.id)]) },
    q,
  };
}

describe("ManualLeadModal", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: "lead-1", error: null }));

  it("adds a lead with no form from name, email, phone and notes", async () => {
    const onAdded = vi.fn();
    render(<ManualLeadModal forms={[]} onClose={vi.fn()} onAdded={onAdded} />);
    fireEvent.change(screen.getByTestId("field-manual_name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByTestId("field-manual_email"), { target: { value: "asha@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("lead-1"));
    expect(rpc).toHaveBeenCalledWith("admin_create_manual_lead", {
      p_form_id: null,
      p_data: { manual_name: "Asha Rao", manual_email: "asha@example.com" },
    });
  });

  it("will not add a lead while a required answer is missing", async () => {
    render(<ManualLeadModal forms={[]} onClose={vi.fn()} onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    expect(await screen.findAllByText("This field is required")).toHaveLength(2);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks the chosen form's questions and sends the lead to that form", async () => {
    const { form, q } = applyForm();
    const onAdded = vi.fn();
    render(<ManualLeadModal forms={[form]} onClose={vi.fn()} onAdded={onAdded} />);
    fireEvent.change(screen.getByLabelText(/Form \(optional\)/), { target: { value: form.id } });
    expect(screen.queryByTestId("field-manual_name")).toBeNull();
    fireEvent.change(screen.getByTestId(`field-${q.id}`), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("admin_create_manual_lead", { p_form_id: form.id, p_data: { [q.id]: "Acme" } });
  });

  it("shows why a lead could not be added", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Only the team can add a lead." } });
    render(<ManualLeadModal forms={[]} onClose={vi.fn()} onAdded={vi.fn()} />);
    fireEvent.change(screen.getByTestId("field-manual_name"), { target: { value: "Asha" } });
    fireEvent.change(screen.getByTestId("field-manual_email"), { target: { value: "asha@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    expect(await screen.findByText("Only the team can add a lead.")).toBeInTheDocument();
  });
});
