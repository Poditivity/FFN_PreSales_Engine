import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
const eq = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from: () => ({ delete: () => ({ eq }) }) }),
}));

import { FormDeleteButton } from "./FormDeleteButton";

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockResolvedValue({ error: null });
});

describe("FormDeleteButton", () => {
  it("is disabled, and explains why on hover, when the form has submissions", () => {
    const { container } = render(<FormDeleteButton id="f1" title="Apply" submissionCount={3} />);
    const button = screen.getByRole("button", { name: /delete/i });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("title");
    fireEvent.mouseEnter(container.querySelector(".ffn-tooltip-anchor")!);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/has submissions and is linked to leads, hubs and more, so it can't be deleted/i);
  });

  it("asks before deleting, then deletes, refreshes and redirects", async () => {
    render(<FormDeleteButton id="f1" title="Apply" submissionCount={0} redirectTo="/admin/forms" />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(eq).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /delete form/i }));
    await waitFor(() => expect(eq).toHaveBeenCalledWith("id", "f1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/forms"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the database's refusal and stays open", async () => {
    eq.mockResolvedValue({ error: { message: "This form has submissions and cannot be deleted. Close it instead." } });
    render(<FormDeleteButton id="f1" title="Apply" submissionCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete form/i }));
    expect(await screen.findByText(/cannot be deleted/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
