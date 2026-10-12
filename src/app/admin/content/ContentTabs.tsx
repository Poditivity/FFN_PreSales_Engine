"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/content/tracks", label: "Tracks" },
  { href: "/admin/content/programs", label: "Programs" },
  { href: "/admin/content/founders", label: "Founders" },
  { href: "/admin/content/case-studies", label: "Case Studies" },
  { href: "/admin/content/testimonials", label: "Testimonials" },
  { href: "/admin/content/mentors", label: "Mentors" },
  { href: "/admin/content/faqs", label: "FAQs" },
  { href: "/admin/content/collections", label: "Collections" },
];

export function ContentTabs() {
  const pathname = usePathname();
  return (
    <div
      className="flex flex-wrap"
      style={{ gap: "var(--space-1)", borderBottom: "1px solid var(--border)", marginBottom: "var(--space-6)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="label"
            style={{
              padding: "var(--space-3)",
              color: active ? "var(--ink)" : "var(--ink-muted)",
              textDecoration: "none",
              borderBottom: active ? "2px solid var(--brand-solid)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
