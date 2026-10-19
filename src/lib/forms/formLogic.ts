// Ported from build-fellowship's app/src/lib/formLogic.js (the real source
// system for this feature, examined directly — not the condensed skill
// summary). Field types, validation and the makeField() shape all match the
// source; only the TypeScript typing is this project's own.

import { DEFAULT_FILE_CONFIG, normalizeFileConfig, type FileFieldConfig } from "../../../supabase/functions/_shared/uploadRules";
import { DISPLAY_FIELD_TYPES } from "../../../supabase/functions/_shared/formSchema";

export type FieldType =
  | "text"
  | "name"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "select"
  | "multiselect"
  | "radio"
  | "date"
  | "rating"
  | "file"
  | "section_header"
  | "text_block";

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Short text" },
  { type: "name", label: "Name" },
  { type: "textarea", label: "Long text" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "number", label: "Number" },
  { type: "url", label: "URL" },
  { type: "select", label: "Dropdown" },
  { type: "multiselect", label: "Multi-select" },
  { type: "radio", label: "Radio group" },
  { type: "date", label: "Date" },
  { type: "rating", label: "Rating (1-5)" },
  { type: "file", label: "File upload" },
  { type: "section_header", label: "Section" },
  { type: "text_block", label: "Text box" },
];

/** Steps that only show something and ask nothing: a section heading or a block of text. */
export const isDisplayType = (type: FieldType) => DISPLAY_FIELD_TYPES.includes(type);

const NEEDS_OPTIONS: FieldType[] = ["select", "multiselect", "radio"];
export const fieldNeedsOptions = (type: FieldType) => NEEDS_OPTIONS.includes(type);
export const isInputField = (type: FieldType) => !isDisplayType(type);

export type ShowIfOperator = "equals" | "not_equals" | "contains" | "not_empty";

export interface ShowIf {
  field: string;
  operator: ShowIfOperator;
  value?: unknown;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  helpText: string;
  width: "full" | "half";
  options?: string[];
  validation: FieldValidation;
  showIf: ShowIf | null;
  /** Text box only: the text the applicant reads. A link is written as [label](https://...). */
  content?: string;
  /** File questions only: which file types are accepted and how large a file may be. */
  fileConfig?: FileFieldConfig;
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function makeField(type: FieldType): FormField {
  return {
    id: uid("field"),
    type,
    label: type === "section_header" ? "Section" : type === "text_block" ? "Text box" : type === "name" ? "Your name" : "Untitled question",
    placeholder: "",
    required: false,
    helpText: "",
    width: "full",
    options: fieldNeedsOptions(type) ? ["Option 1", "Option 2"] : undefined,
    content: type === "text_block" ? "" : undefined,
    validation: {},
    showIf: null,
    fileConfig: type === "file" ? { ...DEFAULT_FILE_CONFIG, categories: [...DEFAULT_FILE_CONFIG.categories] } : undefined,
  };
}

/** The rules a file question enforces, with anything missing or out of range corrected. */
export function fileConfigOf(field: Pick<FormField, "fileConfig">, ceilingMb?: number): FileFieldConfig {
  return normalizeFileConfig(field.fileConfig, ceilingMb);
}

// Basic shape check: one @, no spaces, a dot in the domain, no leading,
// trailing or doubled dots, and a TLD of at least two letters.
const EMAIL_RE = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

/** A field collects an email when it is typed as one or is labelled as one. */
export const isEmailField = (field: Pick<FormField, "type" | "label">) =>
  field.type === "email" ||
  ((field.type === "text" || field.type === "textarea") && /\be-?mail\b/i.test(field.label ?? ""));

/** Validate one field's answer. Returns an error string or null. */
export function validateField(field: FormField, value: unknown): string | null {
  if (!isInputField(field.type)) return null;
  const v = field.type === "multiselect" ? ((value as string[]) ?? []) : value;
  const isEmpty = field.type === "multiselect" ? (v as string[]).length === 0 : !v && v !== 0;

  if (field.required && isEmpty) return "This field is required";
  if (isEmpty) return null;

  const str = String(v);
  if (isEmailField(field) && !isValidEmail(str)) {
    return "Enter a valid email address";
  }
  if (field.type === "file" && !/^https:\/\/.+/.test(str)) {
    return "Upload a file";
  }
  if (field.type === "url" && !/^https?:\/\/.+/.test(str)) {
    return "Enter a valid URL (starting with http)";
  }
  if (field.type === "phone" && !/^[\d\s+()-]{6,}$/.test(str)) {
    return "Enter a valid phone number";
  }
  const val = field.validation || {};
  if (typeof v === "string") {
    if (val.minLength && v.length < val.minLength) return `Must be at least ${val.minLength} characters`;
    if (val.maxLength && v.length > val.maxLength) return `Must be at most ${val.maxLength} characters`;
    if (val.pattern) {
      try {
        if (!new RegExp(val.pattern).test(v)) return "Invalid format";
      } catch {
        // ignore bad pattern
      }
    }
  }
  return null;
}
