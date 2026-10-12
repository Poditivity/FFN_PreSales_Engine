// Posts a message to a Google Chat space through the space's incoming webhook
// (Google Chat API, spaces.messages.create under an app-less webhook). Pure
// TypeScript with the secret and fetch passed in, so the edge functions and
// Vitest share it.
//
// The webhook URL is a credential: it carries the key and token in its query
// string. It lives in the GOOGLE_CHAT_WEBHOOK_URL Supabase Function secret and
// is never stored in the database, sent to the browser or written to a log.

export interface ChatResult {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

/** Google Chat rejects a text message over 4,096 characters. */
export const CHAT_TEXT_LIMIT = 4000;

export function isChatWebhookUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "chat.googleapis.com" && url.pathname.includes("/messages");
  } catch {
    return false;
  }
}

export function truncateChatText(text: string): string {
  if (text.length <= CHAT_TEXT_LIMIT) return text;
  return `${text.slice(0, CHAT_TEXT_LIMIT - 20).trimEnd()}\n...and more`;
}

export async function postToGoogleChat(
  webhookUrl: string | null | undefined,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResult> {
  if (!webhookUrl) return { ok: false, status: "skipped", error: "Google Chat is not connected" };
  if (!isChatWebhookUrl(webhookUrl)) {
    return { ok: false, status: "failed", error: "GOOGLE_CHAT_WEBHOOK_URL is not a Google Chat webhook address" };
  }
  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text: truncateChatText(text) }),
    });
    if (res.ok) return { ok: true, status: "sent" };
    // The reply can echo the request, so report the status and Google's reason only.
    let reason = "";
    try {
      const body = await res.json();
      reason = typeof body?.error?.message === "string" ? `: ${body.error.message}` : "";
    } catch {
      // not JSON
    }
    return { ok: false, status: "failed", error: `Google Chat refused the message (${res.status})${reason}` };
  } catch {
    return { ok: false, status: "failed", error: "Could not reach Google Chat" };
  }
}
