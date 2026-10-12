"use client";

import {
  Bell,
  Database,
  FileText,
  Inbox,
  Info,
  LayoutDashboard,
  Link2,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { BrandLockup } from "@/components/BrandLockup";
import { Button } from "@/components/ffn";
import { isBareAuthRoute } from "@/lib/admin/authRoutes";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CommandPalette } from "./_dashboard/CommandPalette";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Every route under /admin lives behind one of these — the single source
// both the desktop sidebar and the mobile bottom nav / "More" sheet render
// from, so they can never drift out of sync with each other.
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/forms", label: "Forms", icon: FileText },
  { href: "/admin/submissions", label: "Submissions", icon: Inbox },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/hubs", label: "Hubs", icon: Link2 },
  { href: "/admin/content/tracks", label: "Content", icon: Database },
  { href: "/admin/settings/ffn-profile", label: "About FFN", icon: Info },
  { href: "/admin/messaging", label: "Messaging", icon: MessagesSquare },
  { href: "/admin/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/team", label: "Team", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// Bottom nav on mobile/tablet only has room for a handful of icons before it
// gets cramped — these four plus "More" (which opens the rest in a sheet)
// cover the sections used most.
const BOTTOM_NAV_PRIMARY = ["/admin", "/admin/leads", "/admin/hubs", "/admin/forms"];

// Whether the desktop sidebar is folded to icons. Kept in localStorage so the
// choice survives a reload; read through useSyncExternalStore so the server
// render (always expanded) and the first client render agree.
const COLLAPSE_KEY = "ffn_sidebar_collapsed";
const COLLAPSE_EVENT = "ffn-sidebar-collapse";

function subscribeCollapsed(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(COLLAPSE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(COLLAPSE_EVENT, notify);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  } catch {
    // Private windows can refuse storage; the toggle still works for this page view.
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function isActive(pathname: string, href: string): boolean {
  // Every admin route starts with /admin/, so the dashboard matches exactly. So does
  // Settings: Notifications and About FFN live under /admin/settings/ but have their own items.
  if (href === "/admin" || href === "/admin/settings") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  email,
  fullName,
  isSuperAdmin = false,
  children,
}: {
  email: string;
  fullName: string | null;
  isSuperAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  // Sign-in and set-password are full-page screens. The layout wraps every admin
  // route for a signed-in visitor, and a code or link signs someone in before they
  // reach them, so the shell has to step aside here (after every hook has run).
  if (isBareAuthRoute(pathname)) return <>{children}</>;

  const primaryItems = NAV_ITEMS.filter((item) => BOTTOM_NAV_PRIMARY.includes(item.href));
  const overflowItems = NAV_ITEMS.filter((item) => !BOTTOM_NAV_PRIMARY.includes(item.href));

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-page)" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col"
        // Pinned to the viewport: the page scrolls beside it, never with it. Without
        // the fixed height the flex row stretches the sidebar to the full page
        // length and the profile and sign out block ends up at the bottom of it.
        style={{
          width: collapsed ? "calc(var(--space-12) + var(--space-6))" : "var(--sidebar-width)",
          transition: "width 200ms cubic-bezier(0.2, 0, 0, 1)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          maxHeight: "100dvh",
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div
          className="flex items-center"
          style={{
            padding: collapsed ? "var(--space-5) 0 var(--space-4)" : "var(--space-5) var(--space-3) var(--space-4) var(--space-5)",
            flexShrink: 0,
            flexDirection: collapsed ? "column" : "row",
            justifyContent: collapsed ? "center" : "space-between",
            gap: "var(--space-3)",
          }}
        >
          <Link href="/admin" aria-label="Founders First Network, dashboard" title="Dashboard" style={{ display: "block" }}>
            {collapsed ? (
              <>
                <Image className="brand-mark__light" src="/logos/ffn-mark-blue.png" alt="Founders First Network" width={32} height={32} priority />
                <Image className="brand-mark__dark" src="/logos/ffn-mark-white.png" alt="Founders First Network" width={32} height={32} />
              </>
            ) : (
              <BrandLockup width="calc(var(--sidebar-width) * 0.6)" />
            )}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => writeCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
          </Button>
        </div>

        {/* Only the nav list scrolls, and only when the window is too short to
            show every item, so the logo above and the profile block below
            never move. */}
        <nav
          className="flex flex-col"
          style={{ gap: "var(--space-1)", padding: "0 var(--space-3) var(--space-3)", flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center label"
                // A folded sidebar shows icons only, so every item carries its name as a tooltip.
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                style={{
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  justifyContent: collapsed ? "center" : undefined,
                  borderRadius: "var(--radius-md)",
                  color: active ? "var(--brand)" : "var(--ink)",
                  background: active ? "var(--surface-selected)" : undefined,
                }}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flexShrink: 0, padding: "var(--space-4) var(--space-3)", borderTop: "1px solid var(--border)", overflow: "hidden" }}>
          <Link
            href="/admin/profile"
            className="flex items-center"
            title={collapsed ? `${fullName || email}: profile and password` : "Profile and password"}
            aria-label={collapsed ? "My profile" : undefined}
            style={{
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              justifyContent: collapsed ? "center" : undefined,
              background: isActive(pathname, "/admin/profile") ? "var(--surface-selected)" : undefined,
            }}
          >
            <User size={16} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
            {!collapsed && (
            <span className="flex flex-col" style={{ minWidth: 0 }}>
              <span className="body-sm" style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fullName || email}
              </span>
              {fullName && (
                <span className="body-sm" style={{ color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {email}
                </span>
              )}
            </span>
            )}
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center label"
            title={collapsed ? "Sign out" : undefined}
            aria-label={collapsed ? "Sign out" : undefined}
            style={{
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              color: "var(--ink-muted)",
              width: "100%",
              textAlign: "left",
              justifyContent: collapsed ? "center" : undefined,
            }}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
        {/* Mobile/tablet top bar */}
        <header
          className="flex lg:hidden items-center"
          style={{
            minHeight: "var(--topbar-height)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "var(--space-2) var(--space-5)",
            flexShrink: 0,
          }}
        >
          <Link href="/admin" aria-label="Founders First Network, dashboard" style={{ display: "block" }}>
            <BrandLockup width="calc(var(--sidebar-width) * 0.6)" />
          </Link>
        </header>

        <main className="flex-1" style={{ padding: "var(--space-8) var(--space-6)" }}>
          <div className="mx-auto" style={{ maxWidth: "var(--content-max)" }}>
            {children}
          </div>
        </main>

        {/* Spacer so content isn't hidden behind the fixed mobile bottom nav */}
        <div className="lg:hidden" style={{ height: "var(--topbar-height)" }} aria-hidden="true" />
      </div>

      {/* Mobile/tablet bottom nav */}
      <nav
        className="flex lg:hidden fixed bottom-0 left-0 right-0 items-stretch justify-around"
        style={{ height: "var(--topbar-height)", borderTop: "1px solid var(--border)", background: "var(--surface)", zIndex: 50 }}
      >
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center"
              style={{ flex: 1, gap: "var(--space-1)", color: active ? "var(--brand)" : "var(--ink-muted)" }}
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="label-sm">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center"
          style={{ flex: 1, gap: "var(--space-1)", color: "var(--ink-muted)" }}
        >
          <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="label-sm">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="lg:hidden"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "flex-end",
            background: "color-mix(in srgb, var(--surface-inverse) 50%, transparent)",
          }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col"
            style={{
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderTopLeftRadius: "var(--radius-xl)",
              borderTopRightRadius: "var(--radius-xl)",
              padding: "var(--space-5)",
              gap: "var(--space-1)",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
              <span className="h2">More</span>
              <Button variant="ghost" size="sm" aria-label="Close" onClick={() => setMoreOpen(false)}>
                <X size={18} />
              </Button>
            </div>

            {overflowItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center label"
                  style={{ gap: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", color: "var(--ink)" }}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}

            <div style={{ borderTop: "1px solid var(--border)", margin: "var(--space-2) 0" }} />

            <Link
              href="/admin/profile"
              onClick={() => setMoreOpen(false)}
              className="flex items-center label"
              style={{ gap: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", color: "var(--ink)" }}
            >
              <User size={18} strokeWidth={1.75} aria-hidden="true" />
              My profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center label"
              style={{ gap: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", color: "var(--ink)", textAlign: "left" }}
            >
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}

      <CommandPalette isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
