// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildObjectKey,
  createImageUpload,
  IMAGE_MAX_BYTES,
  presignUrl,
  publicUrlFor,
  validateUploadRequest,
} from "./r2Presign";

describe("presignUrl", () => {
  // The worked example from AWS's own SigV4 query-string documentation
  // ("Authenticating Requests: Using Query Parameters"). If the signing
  // algorithm is wrong in any detail, this signature does not match.
  it("reproduces the published AWS example signature", async () => {
    const url = await presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresIn: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
        "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
        "&X-Amz-Date=20130524T000000Z" +
        "&X-Amz-Expires=86400" +
        "&X-Amz-SignedHeaders=host" +
        "&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("signs the headers the browser has to send, so they cannot be swapped", async () => {
    const base = {
      method: "PUT" as const,
      host: "acct.r2.cloudflarestorage.com",
      path: "/bucket/founders/photos/a.png",
      region: "auto",
      accessKeyId: "id",
      secretAccessKey: "secret",
      expiresIn: 300,
      now: new Date("2026-09-30T10:00:00Z"),
    };
    const png = await presignUrl({ ...base, headers: { "Content-Type": "image/png" } });
    const jpeg = await presignUrl({ ...base, headers: { "Content-Type": "image/jpeg" } });
    expect(png).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(new URL(png).searchParams.get("X-Amz-Signature")).not.toBe(new URL(jpeg).searchParams.get("X-Amz-Signature"));
  });

  it("rejects a lifetime outside what S3 allows", async () => {
    const input = {
      method: "PUT" as const,
      host: "h",
      path: "/p",
      region: "auto",
      accessKeyId: "a",
      secretAccessKey: "b",
      now: new Date(),
    };
    await expect(presignUrl({ ...input, expiresIn: 0 })).rejects.toThrow();
    await expect(presignUrl({ ...input, expiresIn: 604801 })).rejects.toThrow();
  });
});

describe("validateUploadRequest", () => {
  const ok = { folder: "founders/photos", contentType: "image/png", size: 1000 };

  it("accepts a normal image request", () => {
    expect(validateUploadRequest(ok)).toBeNull();
  });

  it("refuses folders outside the fixed list, including traversal attempts", () => {
    expect(validateUploadRequest({ ...ok, folder: "../secrets" })).toMatch(/folder/i);
    expect(validateUploadRequest({ ...ok, folder: "founders/photos/../../x" })).toMatch(/folder/i);
    expect(validateUploadRequest({ ...ok, folder: undefined })).toMatch(/folder/i);
  });

  it("refuses anything that is not a web image, SVG included", () => {
    expect(validateUploadRequest({ ...ok, contentType: "image/svg+xml" })).toMatch(/JPEG, PNG/);
    expect(validateUploadRequest({ ...ok, contentType: "text/html" })).toMatch(/JPEG, PNG/);
  });

  it("refuses empty and oversized files", () => {
    expect(validateUploadRequest({ ...ok, size: 0 })).toMatch(/empty/);
    expect(validateUploadRequest({ ...ok, size: IMAGE_MAX_BYTES + 1 })).toMatch(/5 MB/);
    expect(validateUploadRequest({ ...ok, size: IMAGE_MAX_BYTES })).toBeNull();
    expect(validateUploadRequest({ ...ok, size: Number.NaN })).toMatch(/empty/);
  });
});

describe("keys and public URLs", () => {
  it("builds the key from folder, id and a fixed extension, never a file name", () => {
    expect(buildObjectKey("mentors/photos", "image/jpeg", "abc")).toBe("mentors/photos/abc.jpg");
    expect(buildObjectKey("founders/logos", "image/webp", "abc")).toBe("founders/logos/abc.webp");
    expect(() => buildObjectKey("mentors/photos", "text/html", "abc")).toThrow();
  });

  it("joins the public base and key with exactly one slash", () => {
    expect(publicUrlFor("https://cdn.example.com", "founders/photos/a.png")).toBe("https://cdn.example.com/founders/photos/a.png");
    expect(publicUrlFor("https://cdn.example.com/", "founders/photos/a.png")).toBe("https://cdn.example.com/founders/photos/a.png");
    expect(publicUrlFor("https://pub-abc.r2.dev//", "a/b.png")).toBe("https://pub-abc.r2.dev/a/b.png");
  });

  it("refuses a public base that is not https, since the app is served over https", () => {
    expect(() => publicUrlFor("http://cdn.example.com", "a.png")).toThrow(/https/);
    expect(() => publicUrlFor("not a url", "a.png")).toThrow();
  });
});

describe("createImageUpload", () => {
  const config = {
    accountId: "0123456789abcdef",
    bucket: "ffn-content",
    accessKeyId: "id",
    secretAccessKey: "secret",
    publicBaseUrl: "https://cdn.example.com",
  };

  it("returns a signed PUT URL, the headers to send, and the public URL that gets stored", async () => {
    const up = await createImageUpload(
      config,
      { folder: "founders/photos", contentType: "image/png", size: 2048 },
      { id: "11111111-2222-3333-4444-555555555555", now: new Date("2026-09-30T10:00:00Z") },
    );
    const url = new URL(up.uploadUrl);
    expect(url.host).toBe("0123456789abcdef.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/ffn-content/founders/photos/11111111-2222-3333-4444-555555555555.png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(up.headers["Content-Type"]).toBe("image/png");
    expect(up.key).toBe("founders/photos/11111111-2222-3333-4444-555555555555.png");
    // The stored value is a working address, not the bare key and not the S3 endpoint.
    expect(up.publicUrl).toBe("https://cdn.example.com/founders/photos/11111111-2222-3333-4444-555555555555.png");
    expect(up.publicUrl).not.toContain("cloudflarestorage.com");
  });

  it("gives every upload its own key", async () => {
    const req = { folder: "mentors/photos", contentType: "image/jpeg", size: 10 };
    const [a, b] = await Promise.all([createImageUpload(config, req), createImageUpload(config, req)]);
    expect(a.key).not.toBe(b.key);
  });

  it("refuses an invalid request before signing anything", async () => {
    await expect(createImageUpload(config, { folder: "x", contentType: "image/png", size: 1 })).rejects.toThrow(/folder/i);
  });
});
