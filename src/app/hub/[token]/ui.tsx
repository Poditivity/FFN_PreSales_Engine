import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

/**
 * Calls back once when an element has been mostly on screen for a moment. That
 * is what a view of a mentor, program or quote means: it was in front of the
 * applicant, not that a cursor crossed it. Touch screens have no cursor at all.
 */
export function useSeen<T extends HTMLElement>(onSeen: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  const callback = useRef(onSeen);
  useEffect(() => {
    callback.current = onSeen;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (done) return;
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => {
            done = true;
            observer.disconnect();
            callback.current();
          }, 1500);
        } else {
          window.clearTimeout(timer);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
  return ref;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** A person, larger than the app's own avatar. The photograph if there is one, initials if not. */
export function Portrait({ name, src, size = "md" }: { name: string; src?: string | null; size?: "md" | "lg" | "xl" }) {
  return (
    <span className={`hub-portrait hub-portrait--${size}`} role="img" aria-label={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URLs, not a static app asset
        <img src={src} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export interface BlockHeading {
  title?: string | null;
  subtitle?: string | null;
}

/** The heading every section opens with: the title and one supporting line. */
export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="hub-head">
      <div>
        <h2 className="hub-h2">{title}</h2>
        {subtitle && <p className="hub-lede">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Splits a saved paragraph into its lines, so a list typed one item per line reads as a list. */
export function splitLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

/** A section of the page. The background alternates from one section to the next in CSS. */
export function Section({ id, children, style }: { id: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section id={id} className="hub-section" style={style}>
      <div className="hub-wrap">{children}</div>
    </section>
  );
}
