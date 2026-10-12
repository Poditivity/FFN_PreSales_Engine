"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Input } from "@/components/ffn";
import { checkImageFile, IMAGE_ACCEPT, uploadImage, type UploadFolder } from "@/lib/content/imageUpload";

/**
 * An image on a content record. Uploading is the main path: the file goes to
 * R2 and the record stores its public URL. Pasting a link to an image that is
 * already hosted elsewhere still works, and a link saved before uploads
 * existed keeps showing as it did.
 */
export function ImageUploadField({
  label,
  folder,
  value,
  onChange,
  error,
  shape = "square",
  testId,
}: {
  label: string;
  folder: UploadFolder;
  value: string | null;
  onChange: (next: string | null) => void;
  error?: string;
  /** "round" for a person's photo, "square" for a logo. */
  shape?: "round" | "square";
  /** Prefix for the data-testid attributes, so a test can find this field. */
  testId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  // Keyed to the URL that failed, so a new value gets a fresh try.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  const shownError = uploadError ?? error;
  const broken = Boolean(value) && brokenUrl === value;

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      onChange(await uploadImage(folder, file));
      setPasting(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "The upload did not finish. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const preview = (
    <div
      style={{
        width: "var(--space-16)",
        height: "var(--space-16)",
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        border: "1px solid var(--border)",
        borderRadius: shape === "round" ? "var(--radius-full)" : "var(--radius-md)",
        background: "var(--surface-sunken)",
        color: "var(--ink-subtle)",
      }}
    >
      {value && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URLs, not a static app asset
        <img
          src={value}
          alt={`Current ${label.toLowerCase()}`}
          data-testid={`${testId}-preview`}
          onError={() => setBrokenUrl(value)}
          style={{ width: "100%", height: "100%", objectFit: shape === "round" ? "cover" : "contain" }}
        />
      ) : (
        <ImageIcon size={22} strokeWidth={1.75} aria-hidden="true" />
      )}
    </div>
  );

  return (
    <div>
      <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
        {label}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
        aria-label={`${label} file`}
        data-testid={`${testId}-input`}
      />

      <div className="flex items-center flex-wrap" style={{ gap: "var(--space-4)" }}>
        {preview}
        <div className="flex flex-col" style={{ gap: "var(--space-2)", minWidth: 0, flex: "1 1 12rem" }}>
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Upload size={14} />}
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? "Replace image" : "Upload image"}
            </Button>
            {value && (
              <Button variant="ghost" size="sm" iconLeft={<Trash2 size={14} />} disabled={uploading} onClick={() => onChange(null)}>
                Remove
              </Button>
            )}
          </div>
          <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
            JPEG, PNG, WebP or GIF, up to 5 MB.{" "}
            {!pasting && (
              <button
                type="button"
                onClick={() => setPasting(true)}
                style={{ color: "var(--brand)", textDecoration: "underline", background: "none", border: 0, padding: 0, cursor: "pointer" }}
              >
                Paste a link instead
              </button>
            )}
          </span>
        </div>
      </div>

      {pasting && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Input
            label={`${label} link`}
            placeholder="https://…"
            value={value ?? ""}
            onChange={(e) => {
              setUploadError(null);
              onChange(e.target.value || null);
            }}
            data-testid={`${testId}-link`}
          />
        </div>
      )}

      {broken && !shownError && (
        <p className="body-sm" style={{ color: "var(--warning)", marginTop: "var(--space-2)" }}>
          This image did not load. Check the link, or upload the file again.
        </p>
      )}
      {shownError && (
        <p className="ffn-field__error" style={{ marginTop: "var(--space-2)" }} role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
