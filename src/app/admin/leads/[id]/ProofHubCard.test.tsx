import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hub } from "@/lib/hubs/types";

const listHubsForLead = vi.fn();
vi.mock("@/lib/hubs/hubs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hubs/hubs")>()),
  listHubsForLead: (...args: unknown[]) => listHubsForLead(...args),
  sendHub: vi.fn(),
}));
vi.mock("@/components/hubs/CreateHubModal", () => ({ CreateHubModal: () => null }));
vi.mock("@/components/hubs/EditContextModal", () => ({ EditContextModal: () => null }));
vi.mock("@/components/hubs/HubActivityModal", () => ({ HubActivityModal: () => null }));

import { ProofHubCard } from "./ProofHubCard";

const hub = { id: "h1", token: "55512f08961f179bd5122e5abc", status: "sent", open_count: 0 } as Hub;

describe("ProofHubCard", () => {
  beforeEach(() => {
    listHubsForLead.mockReset().mockResolvedValue([hub]);
  });

  it("offers a Preview button that opens the untracked preview link, instead of printing the raw URL", async () => {
    render(<ProofHubCard leadId="lead-1" tracks={[]} />);

    const preview = await screen.findByRole("link", { name: "Preview" });
    expect(preview).toHaveAttribute("href", `${window.location.origin}/hub/${hub.token}?preview=1`);
    expect(preview).toHaveAttribute("target", "_blank");

    // The long public URL is no longer rendered as text (it overflowed the card).
    expect(screen.queryByText(new RegExp(`/hub/${hub.token}`))).toBeNull();
    expect(screen.getByText(/Opened 0 times/)).toBeInTheDocument();
  });

  it("keeps a way to copy the public link", async () => {
    render(<ProofHubCard leadId="lead-1" tracks={[]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument());
  });
});
