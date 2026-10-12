// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  acceptAttribute,
  allowedTypes,
  buildFormFileKey,
  checkFormFile,
  clampMaxMb,
  DEFAULT_FILE_CONFIG,
  describeFileConfig,
  findSchemaField,
  normalizeFileConfig,
  resolveContentType,
  UPLOAD_HARD_MAX_MB,
} from "./uploadRules";

const MB = 1024 * 1024;
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("normalizeFileConfig", () => {
  it("falls back to the default when nothing usable is stored", () => {
    expect(normalizeFileConfig(undefined)).toEqual(DEFAULT_FILE_CONFIG);
    expect(normalizeFileConfig({ categories: [], maxMb: "x" })).toEqual(DEFAULT_FILE_CONFIG);
    expect(normalizeFileConfig({ categories: ["exe", "svg"] }).categories).toEqual(DEFAULT_FILE_CONFIG.categories);
  });

  it("keeps known categories in a fixed order and drops unknown ones", () => {
    expect(normalizeFileConfig({ categories: ["word", "bogus", "images"], maxMb: 3 })).toEqual({
      categories: ["images", "word"],
      maxMb: 3,
    });
  });

  it("holds the size between 1 MB and the workspace ceiling, and never above the hard limit", () => {
    expect(normalizeFileConfig({ categories: ["pdf"], maxMb: 50 }).maxMb).toBe(UPLOAD_HARD_MAX_MB);
    expect(normalizeFileConfig({ categories: ["pdf"], maxMb: 50 }, 4).maxMb).toBe(4);
    expect(normalizeFileConfig({ categories: ["pdf"], maxMb: 0.2 }).maxMb).toBe(1);
    expect(normalizeFileConfig({ categories: ["pdf"], maxMb: 2 }, 100).maxMb).toBe(2);
    expect(clampMaxMb(-3)).toBe(5);
    expect(clampMaxMb(1)).toBe(1);
  });

  it("falls back to a workspace ceiling below the default size", () => {
    expect(clampMaxMb(undefined, 2)).toBe(2);
  });
});

describe("what a config accepts", () => {
  it("lists only the types of the categories turned on", () => {
    const types = allowedTypes({ categories: ["pdf", "word"], maxMb: 5 });
    expect(Object.keys(types).sort()).toEqual(["application/msword", DOCX, PDF].sort());
    expect(types[PDF]).toBe("pdf");
  });

  it("never offers SVG or HTML, which can carry script", () => {
    const every = allowedTypes({ categories: ["images", "pdf", "word", "powerpoint", "excel"], maxMb: 5 });
    expect(every).not.toHaveProperty("image/svg+xml");
    expect(every).not.toHaveProperty("text/html");
  });

  it("gives the file picker both the types and the extensions", () => {
    const accept = acceptAttribute({ categories: ["pdf"], maxMb: 5 });
    expect(accept).toBe("application/pdf,.pdf");
  });

  it("describes the rules in one sentence", () => {
    expect(describeFileConfig({ categories: ["images", "pdf"], maxMb: 5 })).toBe("Images, PDF. Up to 5 MB.");
  });
});

describe("checkFormFile", () => {
  const config = { categories: ["pdf" as const], maxMb: 2 };

  it("accepts a file of an allowed type within the size", () => {
    expect(checkFormFile(config, { contentType: PDF, size: MB })).toBeNull();
    expect(checkFormFile(config, { contentType: PDF, size: 2 * MB })).toBeNull();
  });

  it("refuses a type the field did not turn on", () => {
    expect(checkFormFile(config, { contentType: "image/png", size: MB })).toMatch(/not accepted/);
    expect(checkFormFile(config, { contentType: "application/x-msdownload", size: 10 })).toMatch(/not accepted/);
  });

  it("refuses an empty file and one over the size", () => {
    expect(checkFormFile(config, { contentType: PDF, size: 0 })).toBe("That file is empty.");
    expect(checkFormFile(config, { contentType: PDF, size: Number.NaN })).toBe("That file is empty.");
    expect(checkFormFile(config, { contentType: PDF, size: 2 * MB + 1 })).toMatch(/over 2 MB/);
  });
});

describe("resolveContentType", () => {
  it("trusts a reported type on the list", () => {
    expect(resolveContentType({ name: "cv.pdf", type: PDF })).toBe(PDF);
  });

  it("falls back to the extension when the system reports nothing", () => {
    expect(resolveContentType({ name: "deck.PPTX", type: "" })).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(resolveContentType({ name: "notes.docx", type: "application/octet-stream" })).toBe(DOCX);
  });

  it("does not invent a type for an extension that is not on the list", () => {
    expect(resolveContentType({ name: "run.exe", type: "" })).toBe("");
    expect(resolveContentType({ name: "page.html", type: "text/html" })).toBe("text/html");
  });
});

describe("buildFormFileKey", () => {
  const formId = "11111111-1111-1111-1111-111111111111";
  const config = { categories: ["pdf" as const], maxMb: 5 };

  it("keys by form and a fresh id, with the extension of the type, never a file name", () => {
    expect(buildFormFileKey(formId, PDF, "abc", config)).toBe(`forms/${formId}/abc.pdf`);
  });

  it("refuses a type the config does not allow, and a form id that is not one", () => {
    expect(() => buildFormFileKey(formId, "image/png", "abc", config)).toThrow();
    expect(() => buildFormFileKey("../../etc", PDF, "abc", config)).toThrow();
  });
});

describe("findSchemaField", () => {
  const field = { id: "f1", type: "file", fileConfig: { categories: ["pdf"], maxMb: 3 } };

  it("finds a field in a graph schema, and only on question nodes", () => {
    const graph = {
      nodes: [
        { type: "start", data: {} },
        { type: "question", data: { field } },
        { type: "end", data: { field: { id: "f2", type: "file" } } },
      ],
    };
    expect(findSchemaField(graph, "f1")).toBe(field);
    expect(findSchemaField(graph, "f2")).toBeNull();
    expect(findSchemaField(graph, "nope")).toBeNull();
  });

  it("finds a field in the older flat schema", () => {
    expect(findSchemaField([field], "f1")).toBe(field);
  });

  it("copes with a missing or odd schema", () => {
    expect(findSchemaField(null, "f1")).toBeNull();
    expect(findSchemaField("x", "f1")).toBeNull();
    expect(findSchemaField({ nodes: "x" }, "f1")).toBeNull();
  });
});
