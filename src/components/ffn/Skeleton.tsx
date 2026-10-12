import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

// A grey block that holds the place of content that has not loaded. It does not
// animate: the design system keeps motion to the two state-change durations, and
// a block that moves while an operator is reading costs more than it gains. The
// sizes are tokens or percentages, never raw pixels.

export interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = "var(--space-4)", circle, className, style }: SkeletonProps) {
  return (
    <span
      className={cx("ffn-skeleton", circle && "ffn-skeleton--circle", className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Lines of text; the last one is shorter, as a paragraph ends. */
export function SkeletonText({ lines = 3, gap = "var(--space-2)" }: { lines?: number; gap?: string }) {
  return (
    <div className="flex flex-col" style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

/** Wraps a loading layout so a screen reader hears one word, not a page of empty blocks. */
export function LoadingRegion({ label = "Loading", children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="ffn-sr">{label}</span>
      {children}
    </div>
  );
}

function PageHeading({ actions = false }: { actions?: boolean }) {
  return (
    <div className="flex items-end justify-between flex-wrap" style={{ gap: "var(--space-4)" }}>
      <div className="flex flex-col" style={{ gap: "var(--space-2)", flex: 1, minWidth: "calc(var(--space-16) * 3)" }}>
        <Skeleton width="min(calc(var(--space-16) * 4), 60%)" height="var(--space-8)" />
        <Skeleton width="min(calc(var(--space-16) * 7), 90%)" height="var(--space-4)" />
      </div>
      {actions && <Skeleton width="calc(var(--space-16) * 2)" height="var(--control-md)" />}
    </div>
  );
}

function Panel({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        padding: padded ? "var(--space-6)" : 0,
      }}
    >
      {children}
    </div>
  );
}

/** A few rows inside a bordered panel, for a list that loads inside a page that has already drawn. */
export function RowsSkeleton({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <LoadingRegion label={label}>
      <Panel padded={false}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between"
            style={{ gap: "var(--space-4)", padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
          >
            <div className="flex flex-col" style={{ gap: "var(--space-2)", flex: 1 }}>
              <Skeleton width="min(calc(var(--space-16) * 3.5), 50%)" />
              <Skeleton width="min(calc(var(--space-16) * 6), 80%)" height="var(--space-3)" />
            </div>
            <Skeleton width="calc(var(--space-16) * 1.5)" height="var(--control-sm)" />
          </div>
        ))}
      </Panel>
    </LoadingRegion>
  );
}

export type PageSkeletonVariant = "list" | "cards" | "detail" | "form";

/**
 * The loading state for an admin page, in the shape of the page it stands in
 * for. Used by each route's loading.tsx, so the page frame appears at once and
 * the content fills in.
 */
export function PageSkeleton({ variant = "list", label }: { variant?: PageSkeletonVariant; label?: string }) {
  const rows = Array.from({ length: 6 }, (_, i) => i);
  return (
    <LoadingRegion label={label}>
      <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
        <PageHeading actions={variant === "list"} />

        {variant === "list" && (
          <>
            <div className="flex flex-wrap" style={{ gap: "var(--space-3)" }}>
              <Skeleton width="min(calc(var(--space-16) * 4.5), 100%)" height="var(--control-md)" />
              <Skeleton width="calc(var(--space-16) * 2)" height="var(--control-md)" />
              <Skeleton width="calc(var(--space-16) * 2)" height="var(--control-md)" />
            </div>
            <Panel padded={false}>
              {rows.map((i) => (
                <div
                  key={i}
                  className="flex items-center"
                  style={{ gap: "var(--space-4)", padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
                >
                  <Skeleton circle width="var(--space-8)" height="var(--space-8)" />
                  <div className="flex flex-col" style={{ gap: "var(--space-2)", flex: 1 }}>
                    <Skeleton width="min(calc(var(--space-16) * 3.5), 50%)" />
                    <Skeleton width="min(calc(var(--space-16) * 6), 80%)" height="var(--space-3)" />
                  </div>
                  <Skeleton width="var(--space-16)" height="var(--space-6)" />
                </div>
              ))}
            </Panel>
          </>
        )}

        {variant === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--space-5)" }}>
            {[0, 1, 2, 3].map((i) => (
              <Panel key={i}>
                <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
                  <Skeleton width="50%" height="var(--space-5)" />
                  <SkeletonText lines={3} />
                  <Skeleton width="calc(var(--space-16) * 1.5)" height="var(--control-md)" />
                </div>
              </Panel>
            ))}
          </div>
        )}

        {variant === "detail" && (
          <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: "var(--space-5)" }}>
            <div className="lg:col-span-2 flex flex-col" style={{ gap: "var(--space-5)" }}>
              <Panel>
                <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
                  <Skeleton width="40%" height="var(--space-5)" />
                  <SkeletonText lines={4} />
                </div>
              </Panel>
              <Panel>
                <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
                  <Skeleton width="30%" height="var(--space-5)" />
                  <SkeletonText lines={3} />
                </div>
              </Panel>
            </div>
            <Panel>
              <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
                <Skeleton width="50%" height="var(--space-5)" />
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height="var(--control-md)" />
                ))}
              </div>
            </Panel>
          </div>
        )}

        {variant === "form" && (
          <Panel>
            <div className="flex flex-col" style={{ gap: "var(--space-5)", maxWidth: "var(--prose-max)" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                  <Skeleton width="calc(var(--space-16) * 1.5)" height="var(--space-3)" />
                  <Skeleton height="var(--control-md)" />
                </div>
              ))}
              <Skeleton width="calc(var(--space-16) * 1.5)" height="var(--control-md)" />
            </div>
          </Panel>
        )}
      </div>
    </LoadingRegion>
  );
}
