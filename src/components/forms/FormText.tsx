import { splitLinks } from "@/lib/forms/linkText";

/**
 * Text an admin wrote, shown the way it was written: line breaks and blank lines
 * stay, and links (see linkText.ts) are clickable.
 */
export function FormText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return (
    <p className={className} style={{ whiteSpace: "pre-line", overflowWrap: "anywhere", ...style }}>
      {splitLinks(text).map((part, i) =>
        part.kind === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brand)", textDecoration: "underline" }}
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
