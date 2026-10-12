// Kept out of MessagingHub.tsx: that file is a client component, and a server
// page cannot read a value exported from one (it only gets a reference).
export type MessagingTab = "compose" | "email" | "whatsapp" | "rules";

export const MESSAGING_TABS: MessagingTab[] = ["compose", "email", "whatsapp", "rules"];
