"use client";

import { Paperclip, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field } from "@/components/ffn";
import {
  acceptAttribute,
  checkFormFile,
  describeFileConfig,
  resolveContentType,
  type FileFieldConfig,
} from "../../../supabase/functions/_shared/uploadRules";

export interface FileFieldProps {
  id: string;
  label: string;
  required: boolean;
  helpText?: string;
  /** The stored answer: the URL of the uploaded file. */
  value: unknown;
  error?: string | null;
  config: FileFieldConfig;
  /** Uploads the file and resolves to the URL to keep. Absent when uploads cannot run, as in an unsaved form's preview. */
  onUpload?: (file: File) => Promise<string>;
  onChange: (value: unknown) => void;
  onBusyChange?: (busy: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

export function FileField({ id, label, required, helpText, value, error, config, onUpload, onChange, onBusyChange, onFocus, onBlur }: FileFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);

  const hasFile = typeof value === "string" && value !== "";

  // Leaving mid-upload must not leave the form waiting for it.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUpload) return;

    const issue = checkFormFile(config, { contentType: resolveContentType(file), size: file.size });
    if (issue) {
      setProblem(issue);
      return;
    }

    setProblem(null);
    setUploading(true);
    onBusyChange?.(true);
    try {
      const url = await onUpload(file);
      setPicked({ name: file.name, size: file.size });
      onChange(url);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The upload did not finish. Try again.");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  function remove() {
    setPicked(null);
    setProblem(null);
    onChange("");
  }

  const hint = [helpText, describeFileConfig(config)].filter(Boolean).join(" ");

  return (
    <Field label={label} required={required} hint={hint} error={problem ?? error ?? undefined} htmlFor={inputId}>
      <div className="flex flex-col" style={{ gap: "var(--space-3)" }} onFocus={onFocus} onBlur={onBlur}>
        <input
          ref={inputRef}
          id={inputId}
          data-testid={`field-${id}`}
          type="file"
          className="ffn-sr"
          accept={acceptAttribute(config)}
          disabled={uploading || !onUpload}
          onChange={choose}
        />

        {hasFile && (
          <div
            className="flex items-center justify-between"
            style={{
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              border: "1px solid var(--border-control)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
            }}
          >
            <span className="flex items-center" style={{ gap: "var(--space-2)", minWidth: 0 }}>
              <Paperclip size={16} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--ink-subtle)", flex: "none" }} />
              <span className="body-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid={`file-name-${id}`}>
                {picked ? `${picked.name} (${formatSize(picked.size)})` : "File uploaded"}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={remove} disabled={uploading} aria-label="Remove file" iconLeft={<X size={14} />}>
              Remove
            </Button>
          </div>
        )}

        <div>
          <Button
            variant="secondary"
            size="lg"
            loading={uploading}
            disabled={!onUpload}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading" : hasFile ? "Replace file" : "Choose file"}
          </Button>
        </div>

        {!onUpload && (
          <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
            Save the form to try uploads. They are switched off in an unsaved preview.
          </p>
        )}
      </div>
    </Field>
  );
}
