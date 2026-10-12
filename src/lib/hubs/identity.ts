import type { Hub } from "./types";

export interface HubIdentity {
  name: string;
  email: string;
  whatsapp: string;
}

// Resolves who a hub is for: a real lead's own identity (never duplicated
// onto the hub) when lead_id is set, otherwise the hub's own applicant_*
// fields — the standalone-prospect path. Mirrored (necessarily duplicated,
// not imported) in hub-send/hub-hydrate, which can't reach into this
// Next.js source tree; keep them in sync if this changes.
export function resolveHubIdentity(
  hub: Pick<Hub, "lead_id" | "applicant_name" | "applicant_email" | "applicant_whatsapp">,
  leadIdentity: { name: string; email: string } | null,
): HubIdentity {
  if (hub.lead_id) {
    return { name: leadIdentity?.name ?? "", email: leadIdentity?.email ?? "", whatsapp: "" };
  }
  return {
    name: hub.applicant_name ?? "",
    email: hub.applicant_email ?? "",
    whatsapp: hub.applicant_whatsapp ?? "",
  };
}
