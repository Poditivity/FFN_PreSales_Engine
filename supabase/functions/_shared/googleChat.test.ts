// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CHAT_TEXT_LIMIT, isChatWebhookUrl, postToGoogleChat, truncateChatText } from "./googleChat";

const URL_OK = "https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t";

describe("isChatWebhookUrl", () => {
  it("accepts only an https Google Chat messages address", () => {
    expect(isChatWebhookUrl(URL_OK)).toBe(true);
    for (const bad of ["", null, undefined, "http://chat.googleapis.com/v1/spaces/A/messages", "https://evil.example.com/v1/spaces/A/messages", "https://chat.googleapis.com/v1/other", "not a url"]) {
      expect(isChatWebhookUrl(bad as string)).toBe(false);
    }
  });
});

describe("postToGoogleChat", () => {
  it("skips when nothing is configured", async () => {
    const fetchImpl = vi.fn();
    expect(await postToGoogleChat(null, "hi", fetchImpl)).toEqual({ ok: false, status: "skipped", error: "Google Chat is not connected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses to send to an address that is not Google Chat", async () => {
    const fetchImpl = vi.fn();
    const result = await postToGoogleChat("https://evil.example.com/v1/spaces/A/messages", "hi", fetchImpl);
    expect(result.status).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the text as JSON and reports success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await postToGoogleChat(URL_OK, "hello", fetchImpl)).toEqual({ ok: true, status: "sent" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(URL_OK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "hello" });
  });

  it("reports Google's refusal without echoing the webhook address", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Space not found" } }), { status: 404 }));
    const result = await postToGoogleChat(URL_OK, "hello", fetchImpl);
    expect(result).toEqual({ ok: false, status: "failed", error: "Google Chat refused the message (404): Space not found" });
    expect(JSON.stringify(result)).not.toContain("token=t");
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom https://chat.googleapis.com/?token=t"));
    const result = await postToGoogleChat(URL_OK, "hello", fetchImpl);
    expect(result).toEqual({ ok: false, status: "failed", error: "Could not reach Google Chat" });
  });
});

describe("truncateChatText", () => {
  it("leaves short text alone and cuts long text under the limit", () => {
    expect(truncateChatText("short")).toBe("short");
    const long = truncateChatText("x".repeat(CHAT_TEXT_LIMIT + 500));
    expect(long.length).toBeLessThanOrEqual(CHAT_TEXT_LIMIT);
    expect(long.endsWith("...and more")).toBe(true);
  });
});
