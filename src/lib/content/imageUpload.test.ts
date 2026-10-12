import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ functions: { invoke } }) }));

import { checkImageFile, IMAGE_ACCEPT, NOT_CONFIGURED_MESSAGE, uploadImage } from "./imageUpload";

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });

describe("checkImageFile", () => {
  it("accepts the four web image types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(checkImageFile({ type, size: 10 })).toBeNull();
    }
  });

  it("refuses other types, empty files and files over 5 MB", () => {
    expect(checkImageFile({ type: "image/svg+xml", size: 10 })).toMatch(/JPEG, PNG/);
    expect(checkImageFile({ type: "application/pdf", size: 10 })).toMatch(/JPEG, PNG/);
    expect(checkImageFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(checkImageFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it("offers the file picker exactly the accepted types", () => {
    expect(IMAGE_ACCEPT.split(",").sort()).toEqual(["image/gif", "image/jpeg", "image/png", "image/webp"]);
  });
});

describe("uploadImage", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    invoke.mockReset();
    fetchMock.mockReset();
  });

  it("asks for a URL, PUTs the file with the signed headers, and returns the public URL", async () => {
    invoke.mockResolvedValue({
      data: {
        uploadUrl: "https://acct.r2.cloudflarestorage.com/b/founders/photos/x.png?X-Amz-Signature=abc",
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
        publicUrl: "https://cdn.example.com/founders/photos/x.png",
      },
      error: null,
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const file = png();
    const url = await uploadImage("founders/photos", file);

    expect(invoke).toHaveBeenCalledWith("r2-presign", { body: { folder: "founders/photos", contentType: "image/png", size: file.size } });
    const [putUrl, init] = fetchMock.mock.calls[0];
    expect(putUrl).toContain("X-Amz-Signature=abc");
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("image/png");
    expect(init.body).toBe(file);
    // The value stored on the record is the public address, not the S3 endpoint.
    expect(url).toBe("https://cdn.example.com/founders/photos/x.png");
  });

  it("does not call the server for a file it can already refuse", async () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    await expect(uploadImage("mentors/photos", pdf)).rejects.toThrow(/JPEG, PNG/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says plainly when uploads are not configured, and points to pasting a link", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ code: "not_configured", missing: ["R2_BUCKET"] }) } },
    });
    await expect(uploadImage("mentors/photos", png())).rejects.toThrow(NOT_CONFIGURED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not return a URL when the bucket refuses the PUT", async () => {
    invoke.mockResolvedValue({ data: { uploadUrl: "https://u", headers: {}, publicUrl: "https://cdn/x.png" }, error: null });
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(uploadImage("mentors/photos", png())).rejects.toThrow(/refused \(403\)/);
  });

  it("reports a network or CORS failure without leaking the raw error", async () => {
    invoke.mockResolvedValue({ data: { uploadUrl: "https://u", headers: {}, publicUrl: "https://cdn/x.png" }, error: null });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(uploadImage("mentors/photos", png())).rejects.toThrow(/did not finish/);
  });
});
