"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ffn";
import { caseStudySource, checkPdfFile, pdfFileName, uploadCaseStudyPdf } from "@/lib/content/casePdf";

// What the hub can do with each kind of source, said where the choice is made.
const NOTE = {
  pdf: "The hub shows the pages in the page itself and tracks which pages are read and for how long.",
  drive: "The hub shows Google Drive's viewer and tracks how long it is open. Upload the PDF instead to track pages.",
  other: "This link is not a PDF. Upload the file, or paste a link that ends in .pdf.",
} as const;

/**
 * The case study PDF. Uploading is the main path, because the hub can then read
 * the file itself and track it page by page. A pasted link to a PDF or a Google
 * Drive file also works.
 */
export function CasePdfField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  const source = caseStudySource(value);
  const shownError = uploadError ?? error;

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = checkPdfFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      onChange(await uploadCaseStudyPdf(file));
      setPasting(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "The upload did not finish. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
        Case study PDF <span className="ffn-field__req">*</span>
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
        data-testid="case-pdf-input"
      />

      {value && !pasting ? (
        <div
          className="flex items-center justify-between flex-wrap"
          style={{
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--border-control)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
          }}
        >
          <div className="flex items-center" style={{ gap: "var(--space-3)", minWidth: 0 }}>
            <FileText size={18} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--ink-subtle)", flex: "none" }} />
            <div style={{ minWidth: 0 }}>
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="body-medium"
                style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}
              >
                {pdfFileName(value) ?? value}
              </a>
              <Badge tone={source === "other" ? "warning" : "neutral"} dot={false}>
                {source === "drive" ? "Google Drive" : source === "pdf" ? "PDF" : "Not a PDF"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" size="sm" iconLeft={<Upload size={14} />} loading={uploading} onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Trash2 size={14} />} disabled={uploading} onClick={() => onChange(null)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
            <Button variant="secondary" iconLeft={<Upload size={15} />} loading={uploading} onClick={() => inputRef.current?.click()}>
              Upload PDF
            </Button>
            <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
              Up to 25 MB.{" "}
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
          {pasting && (
            <Input
              label="Link to the PDF"
              placeholder="https://…"
              hint="A link that ends in .pdf, or a Google Drive file link."
              value={value ?? ""}
              onChange={(e) => {
                setUploadError(null);
                onChange(e.target.value || null);
              }}
            />
          )}
        </div>
      )}

      {value && !shownError && (
        <p className="body-sm" style={{ color: source === "other" ? "var(--warning)" : "var(--ink-muted)", marginTop: "var(--space-2)" }}>
          {NOTE[source ?? "other"]}
        </p>
      )}
      {shownError && <p className="ffn-field__error" style={{ marginTop: "var(--space-2)" }}>{shownError}</p>}
    </div>
  );
}
