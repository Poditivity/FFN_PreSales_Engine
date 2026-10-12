"use client";

import { Bold, Eye, Italic, Link2, List, ListOrdered, Pencil, Underline, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ffn";
import {
  bodyToEditorHtml,
  emailBodyToHtml,
  hasVisibleText,
  personalizeHtml,
  plainTextToHtml,
  sanitizeEmailHtml,
  TEMPLATE_VARIABLES,
} from "@/lib/messaging/text";

interface Props {
  /** HTML (or older plain text) for the body. Emitted back as sanitized HTML. */
  value: string;
  onChange: (html: string) => void;
  /** The name filled into the preview, so the writer sees what a lead sees. */
  previewName?: string;
  /** Sample values for the preview, for templates that have variables beyond name and hub link. */
  previewVars?: Record<string, string>;
  /**
   * Draws the Preview tab itself, for text that is not an email (a hub section).
   * The default preview is the email's own styling, which is written for a white
   * page and so has to sit on a white frame, whatever the admin's theme.
   */
  renderPreview?: (html: string) => React.ReactNode;
  minHeight?: number;
  label?: string;
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="msg-tool"
      title={label}
      aria-label={label}
      // Keeps the selection in the editor while a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * A visual editor for an email body: what you see is what the lead receives, so
 * nobody writes HTML. The output is sanitized on every change, and again on the
 * server before sending. A Preview tab shows the body with {{name}} filled in.
 */
const HUB_LINK_SAMPLE = TEMPLATE_VARIABLES.find((v) => v.key === "hub_link")?.sample ?? "";

export function RichTextEditor({ value, onChange, previewName = "", previewVars, renderPreview, minHeight = 260, label = "Message" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const range = useRef<Range | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [empty, setEmpty] = useState(() => !hasVisibleText(value));
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("https://");

  // Load what the parent hands in (a chosen template, a reset), but never
  // rewrite the editor for a value it just emitted: that would move the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = bodyToEditorHtml(value);
    emitted.current = value;
    setEmpty(!hasVisibleText(value));
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeEmailHtml(el.innerHTML);
    emitted.current = html;
    setEmpty(!hasVisibleText(html));
    onChange(html);
  }

  function run(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function openLink() {
    const sel = window.getSelection();
    const r = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    range.current = r && ref.current?.contains(r.commonAncestorContainer) ? r.cloneRange() : null;
    setLinkOpen((open) => !open);
  }

  function applyLink() {
    const trimmed = url.trim();
    const href = SAFE_URL.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
    ref.current?.focus();
    if (range.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range.current);
    }
    if (window.getSelection()?.isCollapsed) {
      document.execCommand("insertHTML", false, `<a href="${href}">${href}</a>`);
    } else {
      document.execCommand("createLink", false, href);
    }
    setLinkOpen(false);
    setUrl("https://");
    emit();
  }

  return (
    <div className="msg-editor">
      <div className="msg-editor__bar">
        <span className="label-sm" style={{ color: "var(--ink-muted)", marginRight: "auto" }}>
          {label}
        </span>
        <div className="dash-segment" role="group" aria-label="Editor view">
          {(
            [
              { key: "edit", icon: Pencil, text: "Write" },
              { key: "preview", icon: Eye, text: "Preview" },
            ] as const
          ).map(({ key, icon: Icon, text }) => (
            <button
              key={key}
              type="button"
              className="dash-segment__btn label-sm flex items-center"
              style={{ gap: "var(--space-2)" }}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              <Icon size={13} strokeWidth={1.75} aria-hidden />
              {text}
            </button>
          ))}
        </div>
      </div>

      <div hidden={mode !== "edit"}>
        <div className="msg-toolbar" role="toolbar" aria-label="Formatting">
          <select
            className="msg-blockselect"
            aria-label="Text style"
            defaultValue="p"
            onChange={(e) => {
              run("formatBlock", `<${e.target.value}>`);
              e.target.value = "p";
            }}
          >
            <option value="p">Paragraph</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
          </select>
          <span className="msg-sep" aria-hidden />
          <ToolButton label="Bold" onClick={() => run("bold")}>
            <Bold size={15} strokeWidth={1.75} />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => run("italic")}>
            <Italic size={15} strokeWidth={1.75} />
          </ToolButton>
          <ToolButton label="Underline" onClick={() => run("underline")}>
            <Underline size={15} strokeWidth={1.75} />
          </ToolButton>
          <span className="msg-sep" aria-hidden />
          <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
            <List size={15} strokeWidth={1.75} />
          </ToolButton>
          <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>
            <ListOrdered size={15} strokeWidth={1.75} />
          </ToolButton>
          <span className="msg-sep" aria-hidden />
          <ToolButton label="Add a link" onClick={openLink}>
            <Link2 size={15} strokeWidth={1.75} />
          </ToolButton>
          <ToolButton label="Remove link" onClick={() => run("unlink")}>
            <Unlink size={15} strokeWidth={1.75} />
          </ToolButton>
          <span className="msg-sep" aria-hidden />
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.token}
              type="button"
              className="msg-var data-sm"
              title={`Insert ${v.label}. ${
                v.key === "hub_link"
                  ? "It becomes the address of the lead's own hub when the message is sent."
                  : "It becomes the lead's name when the message is sent."
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run("insertText", v.token)}
            >
              {v.token}
            </button>
          ))}
        </div>

        {linkOpen && (
          <div className="msg-linkbar">
            <input
              className="ffn-control ffn-control--sm"
              aria-label="Link address"
              placeholder="https://"
              value={url}
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button size="sm" onClick={applyLink} disabled={!url.trim() || url.trim() === "https://"}>
              Add link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
          </div>
        )}

        <div
          ref={ref}
          className={`msg-surface${empty ? " msg-surface--empty" : ""}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          data-placeholder="Write your message"
          style={{ minHeight }}
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Paste as clean content: the sanitized markup if there is any, plain text otherwise.
            e.preventDefault();
            const html = e.clipboardData.getData("text/html");
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertHTML", false, html ? sanitizeEmailHtml(html) : plainTextToHtml(text));
            emit();
          }}
        />
      </div>

      {mode === "preview" && (
        <div
          className={renderPreview ? "msg-preview-frame" : "msg-preview msg-preview--email"}
          data-theme={renderPreview ? undefined : "light"}
          style={{ minHeight }}
        >
          {empty ? (
            <p className="body-sm" style={{ color: "var(--ink-subtle)", margin: 0 }}>
              Nothing to preview yet.
            </p>
          ) : renderPreview ? (
            renderPreview(value)
          ) : (
            <div dangerouslySetInnerHTML={{ __html: personalizeHtml(emailBodyToHtml(value), previewName, { hub_link: HUB_LINK_SAMPLE, ...previewVars }) }} />
          )}
        </div>
      )}
    </div>
  );
}
