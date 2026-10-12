// What an applicant may upload through a form's file field. Pure TypeScript with
// no Deno or Node imports, so the form-upload-presign edge function, the form
// builder and the public form all apply exactly the same rules, and Vitest
// exercises them.
//
// Two layers keep uploads limited, the second narrowing the first:
//   1. Hard limits in this file: a fixed list of document and image types, and a
//      ceiling on size. Nothing the team configures can go past them.
//   2. A limit per field: the types and the maximum size the team sets on each
//      file question in the form builder. This is the only place the team sets
//      a file limit.
//
// SVG and HTML are not on the list on purpose: both can carry script.

export const FILE_CATEGORIES = {
  images: {
    label: "Images",
    hint: "JPEG, PNG, WebP, GIF",
    types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" },
  },
  pdf: {
    label: "PDF",
    hint: "PDF",
    types: { "application/pdf": "pdf" },
  },
  word: {
    label: "Word",
    hint: "DOC, DOCX",
    types: {
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    },
  },
  powerpoint: {
    label: "PowerPoint",
    hint: "PPT, PPTX",
    types: {
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    },
  },
  excel: {
    label: "Excel",
    hint: "XLS, XLSX",
    types: {
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    },
  },
} as const satisfies Record<string, { label: string; hint: string; types: Record<string, string> }>;

export type FileCategory = keyof typeof FILE_CATEGORIES;
export const FILE_CATEGORY_IDS = Object.keys(FILE_CATEGORIES) as FileCategory[];

/** The most a single file can be, whatever the team sets. */
export const UPLOAD_HARD_MAX_MB = 10;
/** The size a new file question starts at. */
export const UPLOAD_DEFAULT_MAX_MB = 5;

const BYTES_PER_MB = 1024 * 1024;

export interface FileFieldConfig {
  categories: FileCategory[];
  /** Per file, in MB. */
  maxMb: number;
}

export const DEFAULT_FILE_CONFIG: FileFieldConfig = { categories: ["images", "pdf"], maxMb: UPLOAD_DEFAULT_MAX_MB };

export function clampMaxMb(value: unknown, ceilingMb: number = UPLOAD_HARD_MAX_MB): number {
  const ceiling = Math.min(Math.max(Math.floor(Number(ceilingMb)) || UPLOAD_HARD_MAX_MB, 1), UPLOAD_HARD_MAX_MB);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.min(UPLOAD_DEFAULT_MAX_MB, ceiling);
  return Math.min(Math.max(Math.round(n), 1), ceiling);
}

/**
 * Turns whatever is stored on a field into a config that is safe to enforce.
 * Unknown categories are dropped, an empty list falls back to the default, and
 * the size is held between 1 MB and the ceiling.
 */
export function normalizeFileConfig(raw: unknown, ceilingMb: number = UPLOAD_HARD_MAX_MB): FileFieldConfig {
  const source = (raw && typeof raw === "object" ? raw : {}) as { categories?: unknown; maxMb?: unknown };
  const picked = Array.isArray(source.categories)
    ? FILE_CATEGORY_IDS.filter((id) => (source.categories as unknown[]).includes(id))
    : [];
  return {
    categories: picked.length > 0 ? picked : [...DEFAULT_FILE_CONFIG.categories],
    maxMb: clampMaxMb(source.maxMb ?? DEFAULT_FILE_CONFIG.maxMb, ceilingMb),
  };
}

/** content type -> file extension, for the categories a config allows. */
export function allowedTypes(config: FileFieldConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of config.categories) Object.assign(out, FILE_CATEGORIES[id].types);
  return out;
}

/** What the file picker offers: every allowed type plus its extensions. */
export function acceptAttribute(config: FileFieldConfig): string {
  const types = allowedTypes(config);
  return [...Object.keys(types), ...Object.values(types).map((ext) => `.${ext}`)].join(",");
}

/** "Images, PDF. Up to 5 MB." One sentence the form shows beside the picker. */
export function describeFileConfig(config: FileFieldConfig): string {
  const names = config.categories.map((id) => FILE_CATEGORIES[id].label).join(", ");
  return `${names}. Up to ${config.maxMb} MB.`;
}

const EXTENSION_TYPES: Record<string, string> = Object.fromEntries(
  FILE_CATEGORY_IDS.flatMap((id) => Object.entries(FILE_CATEGORIES[id].types).map(([type, ext]) => [ext, type])),
);

/**
 * Some systems report no type, or a generic one, for .docx and .pptx. Fall back
 * to the extension, but only for an extension on the list.
 */
export function resolveContentType(file: { name: string; type: string }): string {
  const reported = (file.type ?? "").toLowerCase();
  const known = reported && FILE_CATEGORY_IDS.some((id) => reported in FILE_CATEGORIES[id].types);
  if (known) return reported;
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  return EXTENSION_TYPES[ext] ?? reported;
}

/** The sentence to show when a file is not acceptable, or null when it is. */
export function checkFormFile(config: FileFieldConfig, file: { contentType: string; size: number }): string | null {
  const types = allowedTypes(config);
  if (!(file.contentType in types)) {
    const names = config.categories.map((id) => FILE_CATEGORIES[id].label).join(", ");
    return `That file type is not accepted here. Choose one of: ${names}.`;
  }
  if (typeof file.size !== "number" || !Number.isFinite(file.size) || file.size <= 0) return "That file is empty.";
  if (file.size > config.maxMb * BYTES_PER_MB) return `That file is over ${config.maxMb} MB. Make it smaller and try again.`;
  return null;
}

/** The object key for an upload. The caller never chooses any part of it but the form. */
export function buildFormFileKey(formId: string, contentType: string, id: string, config: FileFieldConfig): string {
  const ext = allowedTypes(config)[contentType];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  if (!/^[0-9a-f-]{36}$/i.test(formId)) throw new Error("Invalid form id");
  return `forms/${formId}/${id}.${ext}`;
}

// ---------------------------------------------------------------------------
// Reading a file question out of a form's schema
// ---------------------------------------------------------------------------

interface SchemaField {
  id?: string;
  type?: string;
  fileConfig?: unknown;
}

/** Finds a field by id in either schema shape: the node/edge graph or the older flat list. */
export function findSchemaField(schema: unknown, fieldId: string): SchemaField | null {
  const candidates: unknown[] = Array.isArray(schema)
    ? schema
    : schema && typeof schema === "object" && Array.isArray((schema as { nodes?: unknown }).nodes)
      ? (schema as { nodes: { type?: string; data?: { field?: unknown } }[] }).nodes
          .filter((n) => n.type === "question")
          .map((n) => n.data?.field)
      : [];
  for (const c of candidates) {
    const f = c as SchemaField | undefined;
    if (f && f.id === fieldId) return f;
  }
  return null;
}
