import type { Hub } from "@/lib/hubs/types";

// Shared between ProofHubCard (per-lead) and the admin-wide Hubs list, so a
// status always reads the same color wherever it's shown.
export const HUB_STATUS_TONE: Record<Hub["status"], "neutral" | "warning" | "success"> = {
  draft: "neutral",
  sent: "warning",
  opened: "success",
};
