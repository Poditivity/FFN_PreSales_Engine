"use client";

import { Check, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { copyToClipboard, DEFAULT_HUB_MESSAGE, loadHubMessage, whatsappMessage } from "@/lib/messaging/whatsapp";

/**
 * WhatsApp is on hold, so this copies a message for the lead with their name and
 * hub link filled in. Staff paste it into WhatsApp themselves. Without a hub the
 * message is still copied, with the greeting only.
 */
export function CopyWhatsAppButton({ name, hubToken }: { name: string; hubToken: string | null }) {
  const [state, setState] = useState<"idle" | "copied" | "blocked">("idle");
  // Read ahead of the click: some browsers refuse to copy once a request has run in between.
  const [hubMessage, setHubMessage] = useState(DEFAULT_HUB_MESSAGE);
  useEffect(() => {
    loadHubMessage().then(setHubMessage);
  }, []);

  async function copy() {
    const text = whatsappMessage(hubToken ? hubMessage : "Hi {{name}},", name, hubToken);
    const ok = await copyToClipboard(text);
    setState(ok ? "copied" : "blocked");
    setTimeout(() => setState("idle"), 1800);
  }

  const label = state === "copied" ? "Copied" : state === "blocked" ? "Copy not allowed" : "Copy WhatsApp message";
  return (
    <button
      type="button"
      className="lead-btn"
      onClick={copy}
      title={hubToken ? "Copies a message with their name and hub link" : "Copies a greeting. This lead has no hub yet."}
    >
      {state === "copied" ? <Check size={15} aria-hidden /> : <MessageCircle size={15} aria-hidden />} {label}
    </button>
  );
}
