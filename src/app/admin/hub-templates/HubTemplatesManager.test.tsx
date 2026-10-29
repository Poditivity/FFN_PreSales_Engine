import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HubTemplate } from "@/lib/hubs/types";

const updateHubTemplate = vi.fn();
vi.mock("@/lib/hubs/templates", () => ({
  createHubTemplate: vi.fn(),
  deleteHubTemplate: vi.fn(),
  updateHubTemplate: (...a: unknown[]) => updateHubTemplate(...a),
}));
vi.mock("@/lib/hubs/pickerItems", () => ({
  loadItemsByType: () => Promise.resolve({ founders: [], case_studies: [], testimonials: [], mentors: [], programs: [], faqs: [] }),
}));

import { HubTemplatesManager } from "./HubTemplatesManager";

const track = { id: "track-1", name: "Launch" };
const template = (show_navbar: boolean): HubTemplate => ({
  id: "tpl-1",
  track_id: "track-1",
  name: "Default",
  modules: [],
  show_navbar,
  created_at: "",
  updated_at: "",
});
const settings = { booking_url: null, cta_text: null };

beforeEach(() => {
  updateHubTemplate.mockReset();
});

describe("Show the navigation bar", () => {
  it("is on for a template that shows the bar", () => {
    render(<HubTemplatesManager initialTemplates={[template(true)]} tracks={[track] as never} initialSettings={settings} />);
    expect(screen.getByLabelText(/Show the navigation bar/)).toBeChecked();
  });

  it("is off for a template that hides it", () => {
    render(<HubTemplatesManager initialTemplates={[template(false)]} tracks={[track] as never} initialSettings={settings} />);
    expect(screen.getByLabelText(/Show the navigation bar/)).not.toBeChecked();
  });

  it("saves the choice with the template", async () => {
    updateHubTemplate.mockResolvedValue(template(false));
    render(<HubTemplatesManager initialTemplates={[template(true)]} tracks={[track] as never} initialSettings={settings} />);
    fireEvent.click(screen.getByLabelText(/Show the navigation bar/));
    const save = screen.getByRole("button", { name: "Save template" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() =>
      expect(updateHubTemplate).toHaveBeenCalledWith("tpl-1", expect.objectContaining({ show_navbar: false })),
    );
  });
});
