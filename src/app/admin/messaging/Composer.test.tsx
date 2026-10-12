import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({}) }));
vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({ value }: { value: string }) => <div data-testid="editor">{value}</div>,
}));

import type { EmailTemplate } from "@/lib/emailEngine/types";
import { Composer } from "./Composer";

const base = { recipients: [], channel: "email" as const, onChannelChange: () => {}, emailTemplates: [], whatsappTemplates: [] };

function row(over: Partial<EmailTemplate>): EmailTemplate {
  return { id: "r1", name: "x", subject: "", body: "", created_at: "", updated_at: "", ...over } as EmailTemplate;
}

describe("Composer template picker", () => {
  it("offers the system emails after the team's own, on their default wording", () => {
    render(<Composer {...base} emailTemplates={[row({ id: "t1", name: "Follow up", subject: "Hi", body: "<p>Hi</p>" })]} />);
    const labels = Array.from(screen.getByLabelText("Start from an email template").querySelectorAll("option")).map((o) => o.textContent);
    expect(labels).toEqual(["Blank message", "Follow up", "Form submission: confirmation to the applicant (system)", "Form submission: notice to the team (system)", "Hub: link to the applicant (system)"]);

    fireEvent.change(screen.getByLabelText("Start from an email template"), { target: { value: "system:hub_ready" } });
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("Your {{track}} hub is ready");
    expect(screen.getByText(/only filled in there/)).toBeTruthy();
  });

  it("uses the team's edited wording for a system email once it is saved", () => {
    render(<Composer {...base} systemEmails={[row({ system_key: "hub_ready", subject: "Your hub, {{name}}", body: "<p>Hello {{name}}</p>" })]} />);
    fireEvent.change(screen.getByLabelText("Start from an email template"), { target: { value: "system:hub_ready" } });
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("Your hub, {{name}}");
  });

  it("offers the system WhatsApp messages too", () => {
    render(<Composer {...base} channel="whatsapp" />);
    const labels = Array.from(screen.getByLabelText("Start from a WhatsApp template").querySelectorAll("option")).map((o) => o.textContent ?? "");
    expect(labels.filter((l) => l.endsWith("(system)")).length).toBe(5);
  });
});
