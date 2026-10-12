// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createFormFileUpload, parseListPage, presignListUrl } from "./r2Objects";
import { presignUrl } from "./r2Presign";

const config = {
  accountId: "acct",
  bucket: "bucket",
  accessKeyId: "id",
  secretAccessKey: "secret",
  publicBaseUrl: "https://files.example.com",
};
const formId = "11111111-1111-1111-1111-111111111111";
const now = new Date("2026-10-01T10:00:00Z");

describe("createFormFileUpload", () => {
  it("returns a signed PUT for forms/<form>/<id>.<ext> and the public URL it is served from", async () => {
    const upload = await createFormFileUpload(
      config,
      { formId, contentType: "application/pdf", size: 1000, fileConfig: { categories: ["pdf"], maxMb: 5 } },
      { id: "abc", now },
    );
    expect(upload.key).toBe(`forms/${formId}/abc.pdf`);
    expect(upload.publicUrl).toBe(`https://files.example.com/forms/${formId}/abc.pdf`);
    expect(upload.uploadUrl).toContain(`https://acct.r2.cloudflarestorage.com/bucket/forms/${formId}/abc.pdf?`);
    expect(upload.uploadUrl).toContain("X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost");
    expect(upload.headers["Content-Type"]).toBe("application/pdf");
  });

  it("throws the sentence to show for a file the field does not accept", async () => {
    const request = { formId, contentType: "image/png", size: 1000, fileConfig: { categories: ["pdf" as const], maxMb: 5 } };
    await expect(createFormFileUpload(config, request)).rejects.toThrow(/not accepted/);
    await expect(
      createFormFileUpload(config, { ...request, contentType: "application/pdf", size: 6 * 1024 * 1024 }),
    ).rejects.toThrow(/over 5 MB/);
  });
});

describe("bucket listing", () => {
  it("signs the listing query parameters along with the rest", async () => {
    const url = new URL(await presignListUrl(config, "tok/en+1", now));
    expect(url.pathname).toBe("/bucket");
    expect(url.searchParams.get("list-type")).toBe("2");
    expect(url.searchParams.get("max-keys")).toBe("1000");
    expect(url.searchParams.get("continuation-token")).toBe("tok/en+1");
    const without = new URL(await presignListUrl(config, null, now));
    expect(without.searchParams.get("continuation-token")).toBeNull();
    expect(url.searchParams.get("X-Amz-Signature")).not.toBe(without.searchParams.get("X-Amz-Signature"));
  });

  it("changes the signature when an extra query parameter changes", async () => {
    const base = {
      method: "GET" as const,
      host: "h",
      path: "/b",
      region: "auto",
      accessKeyId: "i",
      secretAccessKey: "s",
      expiresIn: 60,
      now,
    };
    const a = await presignUrl({ ...base, query: { "list-type": "2" } });
    const b = await presignUrl({ ...base, query: { "list-type": "1" } });
    expect(a).not.toBe(b);
  });

  it("adds up object sizes and reads the continuation token", () => {
    const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated>
      <Contents><Key>a.png</Key><Size>1000</Size></Contents>
      <Contents><Key>b/c.pdf</Key><LastModified>2026-01-01</LastModified><Size>2500</Size></Contents>
      <NextContinuationToken>1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=&amp;x</NextContinuationToken></ListBucketResult>`;
    expect(parseListPage(xml)).toEqual({ bytes: 3500, objects: 2, nextToken: "1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=&x" });
  });

  it("reports the last page, and an empty bucket", () => {
    expect(parseListPage("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Size>7</Size></Contents></ListBucketResult>")).toEqual({
      bytes: 7,
      objects: 1,
      nextToken: null,
    });
    expect(parseListPage("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")).toEqual({ bytes: 0, objects: 0, nextToken: null });
  });
});
