import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateAppSettings = vi.fn();
const invoke = vi.fn();
vi.mock("@/lib/admin/appSettingsApi", () => ({ updateAppSettings: (...a: unknown[]) => updateAppSettings(...a) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ functions: { invoke } }) }));

import { DigestCard } from "./DigestCard";
import { EscalationCard } from "./EscalationCard";
import { FormsCard } from "./FormsCard";
import { R2UsageCard } from "./R2UsageCard";

const GB = 1024 ** 3;

beforeEach(() => {
  updateAppSettings.mockReset().mockResolvedValue(undefined);
  invoke.mockReset();
});

describe("EscalationCard", () => {
  it("shows a stored delay in the largest even unit, and Save is off until something changes", () => {
    render(<EscalationCard initialMinutes={240} />);
    expect(screen.getByLabelText("Alert after")).toHaveValue(4);
    expect(screen.getByLabelText("Unit")).toHaveValue("hours");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText(/Escalation is on/)).toBeInTheDocument();
  });

  it("saves a new delay as minutes", async () => {
    render(<EscalationCard initialMinutes={null} />);
    expect(screen.getByText(/Escalation is off/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Alert after"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "days" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledWith({ escalation_minutes: 2880 }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("switches escalation off when the box is cleared", async () => {
    render(<EscalationCard initialMinutes={60} />);
    fireEvent.change(screen.getByLabelText("Alert after"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledWith({ escalation_minutes: null }));
  });

  it("will not save a delay that is too short, and says why", () => {
    render(<EscalationCard initialMinutes={null} />);
    fireEvent.change(screen.getByLabelText("Alert after"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "minutes" } });
    expect(screen.getByText("Use at least 5 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows why a save failed", async () => {
    updateAppSettings.mockRejectedValue(new Error("permission denied"));
    render(<EscalationCard initialMinutes={null} />);
    fireEvent.change(screen.getByLabelText("Alert after"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("permission denied")).toBeInTheDocument();
  });
});

describe("DigestCard", () => {
  const initial = {
    daily_digest_enabled: true,
    daily_digest_time: "19:00",
    weekly_digest_enabled: true,
    weekly_digest_day: 1,
    weekly_digest_time: "09:00",
  };

  it("saves changes to the times and the day", async () => {
    render(<DigestCard initial={initial} />);
    fireEvent.change(screen.getByLabelText("Daily time"), { target: { value: "20:30" } });
    fireEvent.change(screen.getByLabelText("Weekly day"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateAppSettings).toHaveBeenCalledWith({ ...initial, daily_digest_time: "20:30", weekly_digest_day: 5 }),
    );
  });

  it("lets either summary be switched off, which disables its time", () => {
    render(<DigestCard initial={initial} />);
    fireEvent.click(screen.getByLabelText(/Send a daily summary/));
    expect(screen.getByLabelText("Daily time")).toBeDisabled();
    expect(screen.getByLabelText("Weekly time")).not.toBeDisabled();
  });

  it("will not save an empty time while the summary is on", () => {
    render(<DigestCard initial={initial} />);
    fireEvent.change(screen.getByLabelText("Weekly time"), { target: { value: "" } });
    expect(screen.getByText("Enter a time, for example 09:00.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("FormsCard", () => {
  const initial = { privacy_policy_url: null, privacy_policy_text: null };

  it("saves the notice and the link", async () => {
    render(<FormsCard initial={initial} />);
    fireEvent.change(screen.getByLabelText("Privacy notice"), { target: { value: "  We keep your details.  " } });
    fireEvent.change(screen.getByLabelText("Privacy policy link"), { target: { value: "https://ffn.example/privacy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateAppSettings).toHaveBeenCalledWith({
        privacy_policy_url: "https://ffn.example/privacy",
        privacy_policy_text: "We keep your details.",
      }),
    );
  });

  it("stores a cleared notice and link as nothing", async () => {
    render(<FormsCard initial={{ privacy_policy_url: "https://ffn.example/p", privacy_policy_text: "Old" }} />);
    fireEvent.change(screen.getByLabelText("Privacy notice"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Privacy policy link"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateAppSettings).toHaveBeenCalledWith({ privacy_policy_url: null, privacy_policy_text: null }),
    );
  });

  it("refuses a policy link that is not https", () => {
    render(<FormsCard initial={initial} />);
    fireEvent.change(screen.getByLabelText("Privacy policy link"), { target: { value: "http://ffn.example/privacy" } });
    expect(screen.getByText("Use a link that starts with https://.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(updateAppSettings).not.toHaveBeenCalled();
  });
});

describe("R2UsageCard", () => {
  it("draws with the last reading, then shows the fresh one in GB with its limit", async () => {
    invoke.mockResolvedValue({
      data: { usedBytes: 1.5 * GB, objects: 1200, checkedAt: "2026-10-01T10:00:00Z", truncated: false, limitGb: 10 },
      error: null,
    });
    render(<R2UsageCard initial={{ usedBytes: 1 * GB, objects: 900, checkedAt: "2026-09-30T10:00:00Z", truncated: false, limitGb: null }} />);
    expect(screen.getByText(/1\.00 GB/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1\.50 GB of 10\.00 GB/)).toBeInTheDocument());
    expect(screen.getByText(/1,200 files/)).toBeInTheDocument();
    expect(screen.getByText(/Checked 2026-10-01 15:30 IST/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("r2-usage", { body: { refresh: false } });
  });

  it("asks for a fresh count on Refresh", async () => {
    invoke.mockResolvedValue({ data: { usedBytes: 0, objects: 0, checkedAt: "2026-10-01T10:00:00Z", truncated: false, limitGb: null }, error: null });
    render(<R2UsageCard initial={null} />);
    await screen.findByText(/0 files/);
    fireEvent.click(screen.getByRole("button", { name: "Refresh Cloudflare usage" }));
    await waitFor(() => expect(invoke).toHaveBeenLastCalledWith("r2-usage", { body: { refresh: true } }));
  });

  it("says Cloudflare is not connected when the secrets are missing", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ code: "not_configured", error: "x" }), { status: 503 }) },
    });
    render(<R2UsageCard initial={null} />);
    expect(await screen.findByText("Cloudflare R2 is not connected")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("keeps the last reading and shows the error when a refresh fails", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ code: "r2_error", error: "Cloudflare refused the request (403)." }), { status: 502 }) },
    });
    render(<R2UsageCard initial={{ usedBytes: 2 * GB, objects: 5, checkedAt: "2026-09-30T10:00:00Z", truncated: false, limitGb: null }} />);
    expect(await screen.findByText("Cloudflare refused the request (403).")).toBeInTheDocument();
    expect(screen.getByText(/2\.00 GB/)).toBeInTheDocument();
  });
});
