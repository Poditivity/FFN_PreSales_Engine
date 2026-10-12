import { cx } from "./cx";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Ported from the FFN design system's bundle.js Avatar — same classes and
// markup (see .claude/skills/ffn-design-system/components/Avatar).
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <span className={cx("ffn-avatar", `ffn-avatar--${size}`, className)} title={name} role="img" aria-label={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URLs, not a static app asset
        <img src={src} alt="" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
