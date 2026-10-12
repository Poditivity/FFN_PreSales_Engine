"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState } from "@/components/ffn";
import { listAdminTeam, type AdminTeamMember } from "@/lib/admin/team";

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never signed in";
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function roleLabel(m: AdminTeamMember): string {
  if (m.isSuperAdmin) return "Super admin";
  return m.role === "admin" ? "Admin" : "Staff";
}

// Super admins only. The list comes from the same edge function as the Team
// page, so it shows each person's most recent sign-in, not a full history.
export function LoginLog() {
  const [members, setMembers] = useState<AdminTeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminTeam().then((res) => {
      if (cancelled) return;
      if (!res.ok) setError(res.error ?? "Could not load sign-ins.");
      else setMembers([...res.members].sort((a, b) => (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "")));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card title="Sign-in log" subtitle="Each person with admin access and when they last signed in." flush>
      {error ? (
        <div style={{ padding: "var(--space-5)" }}>
          <Alert tone="danger" title="Could not load the sign-in log">
            {error}
          </Alert>
        </div>
      ) : members === null ? (
        <p className="body-sm" style={{ padding: "var(--space-5)", color: "var(--ink-muted)" }} role="status">
          Loading sign-ins.
        </p>
      ) : members.length === 0 ? (
        <EmptyState title="No sign-ins yet">Sign-ins appear here once your team has accounts.</EmptyState>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="ffn-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.fullName || m.email}
                    {m.fullName && <span className="ffn-table__sub">{m.email}</span>}
                  </td>
                  <td>
                    <Badge tone={m.isSuperAdmin ? "brand" : "neutral"} dot={false}>
                      {roleLabel(m)}
                    </Badge>
                    {!m.active && (
                      <Badge tone="danger" className="ml-2">
                        Deactivated
                      </Badge>
                    )}
                  </td>
                  <td className="data-sm">{formatDateTime(m.lastSignInAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
