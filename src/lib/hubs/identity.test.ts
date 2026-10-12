import { describe, expect, it } from "vitest";
import { resolveHubIdentity } from "./identity";

describe("resolveHubIdentity", () => {
  it("uses the lead's own identity when the hub has a lead, ignoring any applicant_* fields", () => {
    const hub = { lead_id: "lead-1", applicant_name: "Should never show", applicant_email: "ignored@example.com", applicant_whatsapp: "999" };
    const identity = resolveHubIdentity(hub, { name: "Ada Lovelace", email: "ada@example.com" });
    expect(identity).toEqual({ name: "Ada Lovelace", email: "ada@example.com", whatsapp: "" });
  });

  it("falls back to empty strings when the hub has a lead but no identity was resolved for it", () => {
    const hub = { lead_id: "lead-1", applicant_name: null, applicant_email: null, applicant_whatsapp: null };
    expect(resolveHubIdentity(hub, null)).toEqual({ name: "", email: "", whatsapp: "" });
  });

  it("uses the hub's own applicant fields for a standalone hub with no lead", () => {
    const hub = { lead_id: null, applicant_name: "Grace Hopper", applicant_email: "grace@example.com", applicant_whatsapp: "+1 555 0100" };
    expect(resolveHubIdentity(hub, null)).toEqual({ name: "Grace Hopper", email: "grace@example.com", whatsapp: "+1 555 0100" });
  });

  it("never reads leadIdentity for a standalone hub, even if one was somehow passed", () => {
    const hub = { lead_id: null, applicant_name: "Grace Hopper", applicant_email: null, applicant_whatsapp: null };
    const identity = resolveHubIdentity(hub, { name: "Wrong Person", email: "wrong@example.com" });
    expect(identity.name).toBe("Grace Hopper");
    expect(identity.email).toBe("");
  });
});
