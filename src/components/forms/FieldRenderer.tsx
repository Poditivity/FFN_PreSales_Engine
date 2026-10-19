"use client";

import { Check } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ffn";
import { fileConfigOf, type FormField } from "@/lib/forms/formLogic";
import { FileField } from "./FileField";
import { FormText } from "./FormText";

// FFN-styled rendering for every field type in build-fellowship's real
// FieldComponents.jsx. text/textarea/email/select use the existing FFN
// Input/Textarea/Select primitives; multiselect/radio/rating compose the
// same design tokens (--radius-full, --brand-solid, --border-control, …)
// those primitives already use — nothing here invents a new value.

export interface FieldRendererProps {
  field: FormField;
  value: unknown;
  error?: string | null;
  onChange: (value: unknown) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeystroke?: () => void;
  /** File questions: uploads a file and resolves to the URL to keep. Absent when uploads cannot run. */
  onUploadFile?: (file: File) => Promise<string>;
  /** File questions: told when an upload starts and ends, so the form can wait for it. */
  onBusyChange?: (busy: boolean) => void;
}

function RadioOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ffn-check"
      style={{ border: "none", background: "none", padding: 0, textAlign: "left", width: "100%" }}
      aria-pressed={active}
      onClick={onClick}
    >
      <span
        className={active ? "ffn-check__box ffn-check__box--on" : "ffn-check__box"}
        style={{ borderRadius: "var(--radius-full)" }}
        aria-hidden="true"
      >
        {active && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "var(--radius-full)",
              background: "var(--on-brand)",
            }}
          />
        )}
      </span>
      <span className="ffn-check__text">{label}</span>
    </button>
  );
}

export function FieldRenderer({
  field,
  value,
  error,
  onChange,
  onFocus,
  onBlur,
  onKeystroke,
  onUploadFile,
  onBusyChange,
}: FieldRendererProps) {
  if (field.type === "section_header") {
    return (
      <div style={{ paddingTop: "var(--space-4)", borderTop: "1px solid var(--border)" }}>
        <h3 className="h2">{field.label}</h3>
        {field.helpText && (
          <FormText text={field.helpText} className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }} />
        )}
      </div>
    );
  }

  if (field.type === "text_block") {
    return (
      <div data-testid={`field-${field.id}`}>
        <FormText text={field.content ?? ""} className="body-lg" />
      </div>
    );
  }

  const common = {
    "data-testid": `field-${field.id}`,
    label: field.label,
    required: field.required,
    hint: field.helpText || undefined,
    error: error || undefined,
    size: "lg" as const,
    placeholder: field.placeholder || undefined,
    value: (value as string) ?? "",
    onFocus,
    onBlur,
  };

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          rows={5}
          onKeyDown={onKeystroke}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <Select
          {...common}
          placeholder="Choose one"
          options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={field.label} required={field.required} hint={field.helpText} error={error}>
          <div
            className="flex flex-col"
            style={{ gap: "var(--space-2)" }}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`field-${field.id}`}
          >
            {(field.options ?? []).map((opt) => (
              <Checkbox
                key={opt}
                label={opt}
                checked={selected.includes(opt)}
                onChange={() =>
                  onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
                }
              />
            ))}
          </div>
        </Field>
      );
    }

    case "radio":
      return (
        <Field label={field.label} required={field.required} hint={field.helpText} error={error}>
          <div
            className="flex flex-col"
            style={{ gap: "var(--space-2)" }}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`field-${field.id}`}
          >
            {(field.options ?? []).map((opt) => (
              <RadioOption key={opt} label={opt} active={value === opt} onClick={() => onChange(opt)} />
            ))}
          </div>
        </Field>
      );

    case "rating":
      return (
        <Field label={field.label} required={field.required} hint={field.helpText} error={error}>
          <div
            className="flex"
            style={{ gap: "var(--space-2)" }}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`field-${field.id}`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                variant={Number(value) >= n ? "primary" : "secondary"}
                size="lg"
                aria-label={`${n} of 5`}
                onClick={() => onChange(n)}
                iconLeft={Number(value) >= n ? <Check size={14} /> : undefined}
              >
                {n}
              </Button>
            ))}
          </div>
        </Field>
      );

    case "file":
      return (
        <FileField
          id={field.id}
          label={field.label}
          required={field.required}
          helpText={field.helpText}
          value={value}
          error={error}
          config={fileConfigOf(field)}
          onUpload={onUploadFile}
          onChange={onChange}
          onBusyChange={onBusyChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );

    case "number":
      return <Input {...common} type="number" inputMode="numeric" onKeyDown={onKeystroke} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input {...common} type="date" onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return (
        <Input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          onKeyDown={onKeystroke}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "phone":
      return (
        <Input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onKeyDown={onKeystroke}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "url":
      return <Input {...common} type="url" inputMode="url" onKeyDown={onKeystroke} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input {...common} type="text" onKeyDown={onKeystroke} onChange={(e) => onChange(e.target.value)} />;
  }
}
