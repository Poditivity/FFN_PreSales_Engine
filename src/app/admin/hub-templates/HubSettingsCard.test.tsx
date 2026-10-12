import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateHubSettings = vi.fn();
vi.mock("@/lib/hubs/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hubs/settings")>()),
  updateHubSettings: (...a: unknown[]) => updateHubSettings(...a),
}));
vi.mock("@/lib/hubs/pickerItems", () => ({ loadItemsByType: () => new Promise(() => {}) }));

import { HubSettingsCard } from "./HubTemplatesManager";

beforeEach(() => {
  updateHubSettings.mockReset().mockResolvedValue(undefined);
});

describe("Booking link & call to action", () => {
  it("asks for a booking link and button text, and nothing about a contact person, phone or email", () => {
    render(<HubSettingsCard initialValue={{ booking_url: null, cta_text: null }} />);
    expect(screen.getByLabelText("Booking link")).toBeInTheDocument();
    expect(screen.getByLabelText("Button text")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contact/i)).toBeNull();
    expect(screen.queryByLabelText(/phone/i)).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("saves both, trimmed, once something changes", async () => {
    render(<HubSettingsCard initialValue={{ booking_url: "https://cal.com/old", cta_text: null }} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Booking link"), { target: { value: " https://cal.com/ffn/intro " } });
    fireEvent.change(screen.getByLabelText("Button text"), { target: { value: " Book a call " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateHubSettings).toHaveBeenCalledWith({ booking_url: "https://cal.com/ffn/intro", cta_text: "Book a call" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("will not save a link that is not a full web address", () => {
    render(<HubSettingsCard initialValue={{ booking_url: null, cta_text: null }} />);
    fireEvent.change(screen.getByLabelText("Booking link"), { target: { value: "cal.com/ffn" } });
    expect(screen.getByText(/Enter a full link/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows why a save failed", async () => {
    updateHubSettings.mockRejectedValue(new Error("permission denied"));
    render(<HubSettingsCard initialValue={{ booking_url: null, cta_text: null }} />);
    fireEvent.change(screen.getByLabelText("Button text"), { target: { value: "Talk" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("permission denied")).toBeInTheDocument();
  });
});
