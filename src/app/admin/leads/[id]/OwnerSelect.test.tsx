import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ from: () => ({ update }) }) }));

import { OwnerSelect } from "./OwnerSelect";

const team = [
  { id: "u1", label: "Ananya (ananya@ffn.test)" },
  { id: "u2", label: "Ravi (ravi@ffn.test)" },
];

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockResolvedValue({ error: null });
});

describe("OwnerSelect", () => {
  it("starts on Unassigned and saves the chosen owner", async () => {
    render(<OwnerSelect leadId="l1" ownerId={null} team={team} />);
    const select = screen.getByLabelText("Owner") as HTMLSelectElement;
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "u2" } });
    await waitFor(() => expect(update).toHaveBeenCalledWith({ owner_id: "u2" }));
    expect(eq).toHaveBeenCalledWith("id", "l1");
    expect(await screen.findByText("Owner saved.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("clears the owner when Unassigned is chosen", async () => {
    render(<OwnerSelect leadId="l1" ownerId="u1" team={team} />);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "" } });
    await waitFor(() => expect(update).toHaveBeenCalledWith({ owner_id: null }));
  });

  it("puts the old owner back and says why when the save fails", async () => {
    eq.mockResolvedValue({ error: { message: "permission denied" } });
    render(<OwnerSelect leadId="l1" ownerId="u1" team={team} />);
    const select = screen.getByLabelText("Owner") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "u2" } });
    expect(await screen.findByText(/Could not save the owner: permission denied/)).toBeInTheDocument();
    expect(select.value).toBe("u1");
  });
});
