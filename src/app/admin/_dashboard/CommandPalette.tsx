"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  Inbox,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { StageBadge } from "@/components/ffn";
import { fetchSearchIndex, searchEntries, type SearchEntry } from "@/lib/dashboard/queries";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// Ctrl/Cmd+K anywhere in the admin: jump to a lead, hub or form by name, or
// run a quick action. The dashboard's search button opens it with the same
// window event, so there is one palette, not one per page.
export const OPEN_PALETTE_EVENT = "ffn:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

interface Command {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
  stage?: string;
}

function staticCommands(isSuperAdmin: boolean): Command[] {
  const actions: Command[] = [
    { id: "new-hub", group: "Quick actions", title: "New hub", subtitle: "For an applicant not in the pipeline", href: "/admin/hubs?new=1", icon: Plus },
    { id: "new-form", group: "Quick actions", title: "New form", href: "/admin/forms/new", icon: Plus },
  ];
  if (isSuperAdmin) {
    actions.push({ id: "invite", group: "Quick actions", title: "Invite a teammate", href: "/admin/team", icon: UserPlus });
  }
  const pages: Command[] = [
    { id: "go-dashboard", group: "Go to", title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { id: "go-submissions", group: "Go to", title: "Submissions", href: "/admin/submissions", icon: Inbox },
    { id: "go-leads", group: "Go to", title: "Leads board", href: "/admin/leads", icon: Users },
    { id: "go-hubs", group: "Go to", title: "Hubs", href: "/admin/hubs", icon: Link2 },
    { id: "go-forms", group: "Go to", title: "Forms", href: "/admin/forms", icon: FileText },
    { id: "go-profile", group: "Go to", title: "My profile", href: "/admin/profile", icon: User },
  ];
  return [...actions, ...pages];
}

const ENTRY_ICON: Record<SearchEntry["kind"], LucideIcon> = { lead: Users, hub: Link2, form: FileText };
const ENTRY_GROUP: Record<SearchEntry["kind"], string> = { lead: "Leads", hub: "Hubs", form: "Forms" };

export function CommandPalette({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, [open, show, close]);

  const index = useQuery({
    queryKey: ["command-palette", "index"],
    queryFn: () => fetchSearchIndex(createBrowserSupabaseClient()),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const commands = useMemo<Command[]>(() => {
    const fixed = staticCommands(isSuperAdmin);
    const q = query.trim().toLowerCase();
    if (!q) return fixed;
    const matchedFixed = fixed.filter((c) => c.title.toLowerCase().includes(q));
    const matchedEntries = searchEntries(index.data ?? [], q, 10).map<Command>((e) => ({
      id: `${e.kind}-${e.id}`,
      group: ENTRY_GROUP[e.kind],
      title: e.title,
      subtitle: e.subtitle,
      href: e.href,
      icon: ENTRY_ICON[e.kind],
      stage: e.stage,
    }));
    return [...matchedEntries, ...matchedFixed];
  }, [query, index.data, isSuperAdmin]);

  const safeActive = Math.min(active, Math.max(commands.length - 1, 0));

  function run(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((safeActive + 1) % Math.max(commands.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((safeActive - 1 + commands.length) % Math.max(commands.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(commands[safeActive]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="dash-palette__scrim" onClick={close}>
      <div
        className="dash-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and quick actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-palette__search">
          <label className="dash-palette__field">
            <Search size={18} strokeWidth={1.75} aria-hidden style={{ flex: "none" }} />
            <span className="sr-only">Search leads, hubs and forms</span>
            <input
            ref={inputRef}
            autoFocus
            className="dash-palette__input body-lg"
            placeholder="Search leads, hubs and forms"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={commands[safeActive] ? `${listId}-${commands[safeActive].id}` : undefined}
            aria-autocomplete="list"
            />
          </label>
        </div>

        <ul className="dash-palette__list" id={listId} role="listbox" aria-label="Results">
          {query.trim() && index.isLoading && (
            <li className="dash-palette__group caption" role="presentation">
              Loading leads, hubs and forms
            </li>
          )}
          {query.trim() && index.isError && (
            <li className="dash-palette__group body-sm" role="presentation" style={{ color: "var(--danger)" }}>
              Could not load leads, hubs and forms. Quick actions still work.
            </li>
          )}
          {query.trim() && !index.isLoading && !index.isError && commands.length === 0 && (
            <li className="dash-palette__group body-sm" role="presentation">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </li>
          )}
          {commands.map((command, i) => {
            const Icon = command.icon;
            const header = i === 0 || commands[i - 1].group !== command.group ? command.group : null;
            return (
              <li key={command.id} role="presentation">
                {header && (
                  <p className="dash-palette__group eyebrow" style={{ textTransform: "uppercase", margin: 0 }}>
                    {header}
                  </p>
                )}
                <div
                  id={`${listId}-${command.id}`}
                  role="option"
                  aria-selected={i === safeActive}
                  className="dash-palette__opt"
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(command)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden style={{ color: "var(--ink-subtle)", flex: "none" }} />
                  <span className="ffn-grow flex flex-col">
                    <span className="label ffn-truncate">{command.title}</span>
                    {command.subtitle && (
                      <span className="caption ffn-truncate" style={{ color: "var(--ink-muted)" }}>
                        {command.subtitle}
                      </span>
                    )}
                  </span>
                  {command.stage && <StageBadge stage={command.stage} />}
                  {i === safeActive && <ArrowRight size={16} strokeWidth={1.75} aria-hidden style={{ color: "var(--ink-subtle)" }} />}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="dash-palette__foot caption">
          <span>
            <kbd className="dash-kbd data-sm">Enter</kbd> to open
          </span>
          <span>
            <kbd className="dash-kbd data-sm">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
