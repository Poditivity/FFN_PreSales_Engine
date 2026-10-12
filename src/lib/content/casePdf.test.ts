import { describe, expect, it } from "vitest";
import { caseStudySource, checkPdfFile, driveEmbedUrl, pdfFileName } from "./casePdf";

describe("caseStudySource", () => {
  it("tells a direct PDF, a Drive file and anything else apart", () => {
    expect(caseStudySource("https://x.supabase.co/storage/v1/object/public/case-studies/abc.pdf")).toBe("pdf");
    expect(caseStudySource("https://example.com/files/Report.PDF?download=1")).toBe("pdf");
    expect(caseStudySource("https://drive.google.com/file/d/1v035OtG_pCu1pKpUqIqek5qcPzE9kHPI/view?usp=sharing")).toBe("drive");
    expect(caseStudySource("https://example.com/case-studies/orbitpath")).toBe("other");
  });

  it("returns null for empty or unusable input", () => {
    expect(caseStudySource(null)).toBeNull();
    expect(caseStudySource("")).toBeNull();
    expect(caseStudySource("not a link")).toBeNull();
    expect(caseStudySource("javascript:alert(1)")).toBeNull();
  });
});

describe("driveEmbedUrl", () => {
  it("turns a share link into the embeddable viewer", () => {
    expect(driveEmbedUrl("https://drive.google.com/file/d/abc_123-x/view?usp=sharing")).toBe(
      "https://drive.google.com/file/d/abc_123-x/preview",
    );
  });

  it("does not build an embed for anything that is not a Drive file", () => {
    expect(driveEmbedUrl("https://example.com/a.pdf")).toBeNull();
  });
});

describe("pdfFileName", () => {
  it("shows the file name, or a plain label for Drive", () => {
    expect(pdfFileName("https://example.com/a/b/Orbit%20path.pdf")).toBe("Orbit path.pdf");
    expect(pdfFileName("https://drive.google.com/file/d/abc/view")).toBe("PDF on Google Drive");
    expect(pdfFileName(null)).toBeNull();
  });
});

describe("checkPdfFile", () => {
  it("accepts a normal PDF", () => {
    expect(checkPdfFile({ type: "application/pdf", name: "a.pdf", size: 1024 })).toBeNull();
  });

  it("rejects other types, empty files and files over 25 MB", () => {
    expect(checkPdfFile({ type: "image/png", name: "a.png", size: 1024 })).toMatch(/PDF/);
    expect(checkPdfFile({ type: "application/pdf", name: "a.pdf", size: 0 })).toMatch(/empty/);
    expect(checkPdfFile({ type: "application/pdf", name: "a.pdf", size: 26 * 1024 * 1024 })).toMatch(/25 MB/);
  });
});
