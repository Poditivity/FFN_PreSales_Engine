// The text an admin writes for a form (a text box, a section description, the
// thank-you message) can carry links. A link is written [label](https://...),
// and a bare http(s) address is turned into a link as it stands. Nothing else
// is interpreted, so the text can never inject markup.

export type TextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])/g;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: text.slice(last, at) });
    if (match[1] !== undefined) parts.push({ kind: "link", text: match[1], href: match[2] });
    else parts.push({ kind: "link", text: match[3], href: match[3] });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/**
 * Puts the applicant's name where {name} was written. With no name the token is
 * dropped along with the comma or space that led into it, so "Thank you {name}!"
 * reads "Thank you!" and not "Thank you !".
 */
export function fillName(message: string, name: string): string {
  const who = name.trim();
  if (who) return message.replace(/\{name\}/gi, who);
  return message
    .replace(/^\s*\{name\}[\s,]*/i, "")
    .replace(/\s*,?\s*\{name\}/gi, "");
}
