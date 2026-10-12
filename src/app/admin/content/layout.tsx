import { ContentTabs } from "./ContentTabs";

export default function ContentLayout({ children }: LayoutProps<"/admin/content">) {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-2)" }}>
        <h1 className="h1">Content database</h1>
        <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
          The reusable library the personalized applicant experience will be assembled from. Nothing
          here is published on its own.
        </p>
      </div>
      <ContentTabs />
      {children}
    </div>
  );
}
