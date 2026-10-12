import { LoadingRegion, Skeleton, SkeletonText } from "./Skeleton";

// Loading states for the pages outside the admin shell: sign-in, the public
// form and the public hub. Each is centred or full width on the page ground, in
// the shape of what replaces it.

/** Sign-in and set-password: the mark, a heading and a short form. */
export function AuthSkeleton() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: "var(--surface-page)", padding: "var(--space-6)" }}
    >
      <LoadingRegion>
        <div className="flex w-full flex-col items-center" style={{ width: "calc(var(--space-16) * 5.5)", maxWidth: "100%", gap: "var(--space-8)" }}>
          <Skeleton width="calc(var(--space-16) * 2)" height="var(--space-12)" />
          <div className="flex w-full flex-col" style={{ gap: "var(--space-4)" }}>
            <Skeleton width="60%" height="var(--space-6)" />
            <Skeleton height="var(--control-lg)" />
            <Skeleton height="var(--control-lg)" />
            <Skeleton height="var(--control-lg)" />
          </div>
        </div>
      </LoadingRegion>
    </main>
  );
}

/** The public form: the mark, the title, the progress bar and one question. */
export function PublicFormSkeleton() {
  return (
    <main className="mx-auto w-full" style={{ maxWidth: "var(--prose-max)", padding: "var(--space-10) var(--space-6)" }}>
      <LoadingRegion label="Loading the form">
        <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
          <Skeleton width="calc(var(--space-16) * 2)" height="var(--space-12)" />
          <Skeleton width="70%" height="var(--space-8)" />
          <SkeletonText lines={2} />
          <Skeleton height="var(--space-1)" style={{ marginTop: "var(--space-4)" }} />
          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <Skeleton width="50%" height="var(--space-4)" />
            <Skeleton height="var(--control-lg)" />
          </div>
          <div className="flex justify-end">
            <Skeleton width="calc(var(--space-16) * 1.5)" height="var(--control-lg)" />
          </div>
        </div>
      </LoadingRegion>
    </main>
  );
}

/** The public hub: the bar, the welcome and the first rows of proof. */
export function HubSkeleton() {
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh" }}>
      <LoadingRegion label="Opening your page">
        <div className="flex items-center" style={{ height: "calc(var(--topbar-height) + var(--space-2))", padding: "0 var(--space-6)", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <Skeleton width="calc(var(--space-16) * 2.25)" height="var(--space-8)" />
        </div>
        <div className="mx-auto flex flex-col" style={{ maxWidth: "var(--content-max)", padding: "var(--space-16) var(--space-6)", gap: "var(--space-6)" }}>
          <Skeleton width="calc(var(--space-16) * 2)" height="var(--space-4)" />
          <Skeleton width="min(calc(var(--space-16) * 9), 90%)" height="var(--space-12)" />
          <Skeleton width="min(calc(var(--space-16) * 7), 80%)" height="var(--space-5)" />
          <Skeleton width="calc(var(--space-16) * 2)" height="var(--control-lg)" />
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "var(--space-5)", marginTop: "var(--space-10)" }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height="calc(var(--space-16) * 3)" style={{ borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
