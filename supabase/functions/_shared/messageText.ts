// Message text helpers shared by the admin app and the mail edge functions.
// Pure TypeScript with no imports, so Deno, Next and Vitest all load it as is.
//
// Two rules live here:
//
//   1. An admin can put two variables in a message, in email and in WhatsApp.
//      {{name}} is filled from the lead's own answers and falls back to "there"
//      when the lead gave no name, so "Hi {{name}}," never reads "Hi ,".
//      {{hub_link}} is the address of the lead's own hub. A message that uses it
//      is never sent to a lead who has no hub, so a link is never left empty.
//      Older templates may still hold {{lead_name}} or {{program}}: those keep
//      working when a message is sent, but nothing offers them any more.
//
//   2. Email bodies are written in a visual editor and stored as HTML. Anything
//      that reaches a lead's inbox goes through sanitizeEmailHtml first, on the
//      server, so a stored body can never carry a script or a hostile link.
//      Bodies saved before the visual editor are plain text and are still
//      rendered correctly.

/** The variables the editors offer. Adding one here is what makes it available everywhere. */
export const TEMPLATE_VARIABLES = [
  { token: "{{name}}", key: "name", label: "Name", sample: "Ananya" },
  { token: "{{hub_link}}", key: "hub_link", label: "Hub link", sample: "https://example.com/hub/abc123" },
] as const;

/** Email and WhatsApp offer the same variables. Kept as its own name so the WhatsApp editors read clearly. */
export const WHATSAPP_VARIABLES = TEMPLATE_VARIABLES;

/** Whether a text asks for the lead's hub link. */
export function usesHubLink(text: string): boolean {
  return /\{\{\s*hub_link\s*\}\}/.test(text);
}

export const FALLBACK_NAME = "there";

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The name to greet a lead by: the name they gave, as they gave it, or "there". */
export function greetingName(name: string | null | undefined): string {
  return String(name ?? "").trim().replace(/\s+/g, " ") || FALLBACK_NAME;
}

/** Legacy tokens that older templates carry and that still resolve when sent. */
function legacyTokens(name: string, extra: Record<string, string | null | undefined>) {
  return { name, lead_name: name, ...extra };
}

/** Fills {{name}} into plain text (subjects, WhatsApp). Any other token is left visible, so a typo is easy to spot. */
export function personalizeText(
  text: string,
  name: string | null | undefined,
  extra: Record<string, string | null | undefined> = {},
): string {
  const tokens = legacyTokens(greetingName(name), extra);
  return text.replace(TOKEN, (match, key: string) => {
    if (!(key in tokens)) return match;
    const value = (tokens as Record<string, string | null | undefined>)[key];
    return value == null ? "" : value;
  });
}

/**
 * Same as personalizeText for an HTML body: every value is escaped so a name can
 * never inject markup. {{hub_link}} written as plain text becomes a clickable
 * link, and one used as the address of a link (the editor writes it as
 * "https://{{hub_link}}") becomes that link's address.
 */
export function personalizeHtml(
  html: string,
  name: string | null | undefined,
  extra: Record<string, string | null | undefined> = {},
): string {
  const tokens = legacyTokens(greetingName(name), extra) as Record<string, string | null | undefined>;
  const fill = (segment: string, linkify: boolean) =>
    segment.replace(TOKEN, (match, key: string) => {
      if (!(key in tokens)) return match;
      const value = tokens[key];
      if (value == null || value === "") return "";
      const safe = escapeHtml(value);
      return key === "hub_link" && linkify ? `<a href="${safe}">${safe}</a>` : safe;
    });
  // The editor adds "https://" in front of whatever is typed as a link address,
  // so drop it from in front of the token: the token carries the whole address.
  // {{booking_link}} is only offered in the system emails (see systemTemplates.ts).
  const prepared = html.replace(/https?:\/\/(?=\{\{\s*(?:hub_link|booking_link)\s*\}\})/gi, "");
  // Inside an existing link the value is only text or an address; outside one it becomes a link.
  return prepared
    .split(/(<a\b[^>]*>[\s\S]*?<\/a\s*>)/i)
    .map((segment, i) => fill(segment, i % 2 === 0))
    .join("");
}

/** Variables in a text that the editors do not offer, so the editor can say so before saving. */
export function unknownVariables(
  text: string,
  variables: ReadonlyArray<{ key: string }> = TEMPLATE_VARIABLES,
): string[] {
  const offered = new Set<string>(variables.map((v) => v.key));
  const found = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    if (!offered.has(match[1]) && match[1] !== "lead_name") found.add(`{{${match[1]}}}`);
  }
  return [...found];
}

/** Rewrites the old {{lead_name}} to {{name}} so an older template opens in the editor with the current variable. */
export function modernizeVariables(text: string): string {
  return text.replace(/\{\{\s*lead_name\s*\}\}/g, "{{name}}");
}

// ---- HTML bodies ------------------------------------------------------------

const TAG_MAP: Record<string, string> = {
  b: "strong",
  i: "em",
  strike: "s",
  div: "p",
  h1: "h2",
  h4: "h3",
  h5: "h3",
  h6: "h3",
};
const ALLOWED = new Set(["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote"]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function hrefOf(attrs: string): string | null {
  const m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  const raw = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/[\u0000-\u001f\u007f\s]/g, "")
    .trim();
  return SAFE_HREF.test(raw) ? raw : null;
}

/**
 * Reduces an HTML fragment to the small set of tags an email body needs:
 * paragraphs, line breaks, bold, italic, underline, lists, headings, quotes and
 * links to http, https or mailto. Every attribute except a safe href is dropped,
 * unknown tags are removed with their content kept, and scripts, styles and
 * frames are removed with their content.
 */
export function sanitizeEmailHtml(input: string): string {
  const src = String(input ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");
  const stack: string[] = [];
  let out = "";
  let last = 0;

  const text = (segment: string) => segment.replace(/</g, "&lt;");
  const closeTo = (name: string) => {
    const at = stack.lastIndexOf(name);
    if (at === -1) return;
    while (stack.length > at) out += `</${stack.pop()}>`;
  };

  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    out += text(src.slice(last, m.index));
    last = m.index + m[0].length;

    const raw = m[2].toLowerCase();
    const name = TAG_MAP[raw] ?? raw;
    if (!ALLOWED.has(name)) continue;

    if (m[1]) {
      if (name !== "br") closeTo(name);
      continue;
    }
    if (name === "br") {
      out += "<br>";
      continue;
    }
    if (name === "a") {
      const href = hrefOf(m[3]);
      if (!href) continue;
      out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
      stack.push("a");
      continue;
    }
    // A block tag opened inside an open paragraph ends that paragraph first.
    if (name === "p" || name === "ul" || name === "ol" || name === "h2" || name === "h3" || name === "blockquote") {
      if (stack.includes("p")) closeTo("p");
    }
    out += `<${name}>`;
    stack.push(name);
  }
  out += text(src.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

/** Whether a stored body is HTML from the visual editor rather than older plain text. */
export function looksLikeHtml(body: string): boolean {
  return /<(p|br|div|ul|ol|li|h[1-6]|strong|b|em|i|u|a|blockquote)\b/i.test(body);
}

/** Older plain-text bodies as paragraphs: blank lines split them, single newlines become breaks. */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** The editable form of any stored body: sanitized HTML. */
export function bodyToEditorHtml(body: string): string {
  return looksLikeHtml(body) ? sanitizeEmailHtml(body) : plainTextToHtml(body);
}

const EMAIL_STYLES: Record<string, string> = {
  p: "margin:0 0 14px;font-size:15px;line-height:1.65;color:#0a0c12;",
  h2: "margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;color:#0a0c12;",
  h3: "margin:0 0 10px;font-size:17px;line-height:1.35;font-weight:600;color:#0a0c12;",
  ul: "margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.65;color:#0a0c12;",
  ol: "margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.65;color:#0a0c12;",
  li: "margin:0 0 4px;",
  blockquote: "margin:0 0 14px;padding-left:14px;border-left:3px solid #d5d9e0;color:#4e5566;font-size:15px;line-height:1.65;",
};

/** Sanitized HTML with the inline styles mail clients need, ready to sit inside the branded shell. */
export function emailBodyToHtml(body: string): string {
  const safe = bodyToEditorHtml(body);
  return safe
    .replace(/<(p|h2|h3|ul|ol|li|blockquote)>/g, (_m, tag: string) => `<${tag} style="${EMAIL_STYLES[tag]}">`)
    .replace(/<a href=/g, '<a style="color:#233ce6;" href=');
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&middot;": "·",
  "&hellip;": "…",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

function decodeEntity(entity: string): string {
  const numeric = /^&#(x[0-9a-f]+|\d+);$/i.exec(entity);
  if (numeric) {
    const code = numeric[1][0].toLowerCase() === "x" ? parseInt(numeric[1].slice(1), 16) : parseInt(numeric[1], 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }
  return ENTITIES[entity.toLowerCase()] ?? entity;
}

/** An HTML body as plain text: the text version of an email, and the source of a WhatsApp draft. */
export function htmlToPlainText(html: string): string {
  return sanitizeEmailHtml(html)
    .replace(/<li>/g, "- ")
    .replace(/<\/(p|h2|h3|ul|ol|blockquote)>/g, "\n\n")
    .replace(/<\/li>/g, "\n")
    .replace(/<br>/g, "\n")
    .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_m, href: string, label: string) => {
      const plain = label.replace(/<[^>]*>/g, "");
      return plain.trim() === href ? plain : `${plain} (${href.replace(/&amp;/g, "&")})`;
    })
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A whole email document, branded shell and all, as plain text: the
 * text/plain part sent alongside every HTML email. Mail with only an HTML part
 * scores worse with spam filters and reads as bulk mail to Gmail's sorting.
 */
export function emailDocumentToText(html: string): string {
  const body = String(html ?? "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, "")
    .replace(/\s+/g, " ")
    // Layout tables carry no tags the sanitizer keeps, so their cell and row
    // ends become line breaks rather than running two blocks into one line.
    .replace(/<\/(td|th|tr|table)\s*>/gi, "$&<br>");
  return htmlToPlainText(body)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether an HTML body has any visible text, so an empty editor cannot be sent. */
export function hasVisibleText(html: string): boolean {
  return htmlToPlainText(html).length > 0;
}
