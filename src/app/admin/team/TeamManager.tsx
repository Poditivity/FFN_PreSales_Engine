"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, EmptyState, Input, Modal, RowsSkeleton, Select } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  type AdminTeamMember,
  deleteAdminTeamMember,
  inviteAdminTeamMember,
  type InviteRole,
  listAdminTeam,
  setAdminTeamMemberActive,
  setAdminTeamMemberNotifications,
  setAdminTeamMemberSuperAdmin,
  validateInvite,
} from "@/lib/admin/team";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function TeamManager({ readOnly = false }: { readOnly?: boolean }) {
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmSuperAdmin, setConfirmSuperAdmin] = useState<{ id: string; label: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  async function load() {
    const [result, { data: userData }] = await Promise.all([listAdminTeam(), createBrowserSupabaseClient().auth.getUser()]);
    setCurrentUserId(userData.user?.id ?? null);
    if (!result.ok) {
      setError(result.error ?? "Could not load the team");
    } else {
      setError(null);
      setMembers(result.members);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdminTeam(), createBrowserSupabaseClient().auth.getUser()]).then(([result, { data: userData }]) => {
      if (cancelled) return;
      setCurrentUserId(userData.user?.id ?? null);
      if (!result.ok) {
        setError(result.error ?? "Could not load the team");
      } else {
        setError(null);
        setMembers(result.members);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction(id: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    const result = await action();
    await load();
    // load() clears the banner, so put a refusal back after it: otherwise the row
    // snaps back with no explanation.
    if (!result.ok) setError(result.error ?? "That action failed");
    setBusyId(null);
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteOpen(true)}>Invite team member</Button>
        </div>
      )}

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="brand" title="Already on the team">
          {notice}
        </Alert>
      )}

      {loading ? (
        <RowsSkeleton rows={4} label="Loading the team" />
      ) : members.length === 0 ? (
        <EmptyState title="No team members yet">Invite your first admin account.</EmptyState>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}>
          {members.map((m, i) => {
            const isSelf = m.id === currentUserId;
            const busy = busyId === m.id;
            return (
              <div
                key={m.id}
                data-testid={`team-row-${m.id}`}
                className="flex items-center justify-between flex-wrap"
                style={{ padding: "var(--space-4)", gap: "var(--space-3)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
              >
                <div style={{ minWidth: 200 }}>
                  <p className="body-medium">{m.fullName || m.email}</p>
                  <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                    {m.email} · Last sign-in: {formatDate(m.lastSignInAt)}
                  </p>
                </div>

                <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
                  <span className="body-sm" style={{ textTransform: "capitalize", color: "var(--ink-muted)" }}>
                    {m.role}
                  </span>

                  {readOnly ? (
                    m.isSuperAdmin && <Badge tone="brand">Super admin</Badge>
                  ) : (
                    <label className="flex items-center" style={{ gap: "var(--space-1)" }}>
                      <input
                        type="checkbox"
                        checked={m.isSuperAdmin}
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfirmSuperAdmin({ id: m.id, label: m.fullName || m.email });
                          } else {
                            runAction(m.id, () => setAdminTeamMemberSuperAdmin(m.id, false));
                          }
                        }}
                      />
                      <span className="body-sm">Super admin</span>
                    </label>
                  )}

                  {readOnly ? (
                    <Badge tone={m.receiveNotifications ? "brand" : "neutral"} dot={false}>
                      {m.receiveNotifications ? "Notified" : "Not notified"}
                    </Badge>
                  ) : (
                    <Select
                      size="sm"
                      aria-label={`Send submission notifications to ${m.fullName || m.email}`}
                      value={m.receiveNotifications ? "yes" : "no"}
                      disabled={busy}
                      options={[
                        { value: "yes", label: "Notifications: Yes" },
                        { value: "no", label: "Notifications: No" },
                      ]}
                      onChange={(e) => runAction(m.id, () => setAdminTeamMemberNotifications(m.id, e.target.value === "yes"))}
                    />
                  )}

                  <Badge tone={m.active ? "success" : "danger"}>{m.active ? "Active" : "Deactivated"}</Badge>

                  {!readOnly && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        disabled={isSelf && m.active}
                        title={isSelf && m.active ? "You can't deactivate your own account" : undefined}
                        onClick={() => runAction(m.id, () => setAdminTeamMemberActive(m.id, !m.active))}
                      >
                        {m.active ? "Deactivate" : "Reactivate"}
                      </Button>

                      {!m.active && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirmDelete({ id: m.id, label: m.fullName || m.email })}
                        >
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={(existingEmail) => {
            setInviteOpen(false);
            setNotice(
              existingEmail
                ? `${existingEmail} already has an account, so no email was sent. Their access was updated; their notification setting was left as it was.`
                : null,
            );
            load();
          }}
        />
      )}

      {confirmSuperAdmin && (
        <Modal title="Make super admin?" onClose={() => setConfirmSuperAdmin(null)}>
          <p className="body-sm">
            You are changing <strong>{confirmSuperAdmin.label}</strong>&apos;s role to Super Admin. That means they
            can invite, promote, or deactivate other team members. Is that okay?
          </p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setConfirmSuperAdmin(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const { id } = confirmSuperAdmin;
                setConfirmSuperAdmin(null);
                runAction(id, () => setAdminTeamMemberSuperAdmin(id, true));
              }}
            >
              Make super admin
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete this account?" onClose={() => setConfirmDelete(null)}>
          <p className="body-sm">
            This permanently deletes <strong>{confirmDelete.label}</strong>&apos;s account. They&apos;ll lose access
            immediately and this can&apos;t be undone.
          </p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const { id } = confirmDelete;
                setConfirmDelete(null);
                runAction(id, () => deleteAdminTeamMember(id));
              }}
            >
              Delete permanently
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (existingEmail?: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("admin");
  const [notifications, setNotifications] = useState<"yes" | "no">("yes");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = validateInvite({ email }).email;

  async function invite() {
    setTouched(true);
    if (emailError) return;
    setSaving(true);
    setError(null);
    const result = await inviteAdminTeamMember({ email, name, role, notifications: notifications === "yes" });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not invite this person");
      return;
    }
    onInvited(result.alreadyExisted ? email.trim() : undefined);
  }

  return (
    <Modal title="Invite team member" onClose={onClose}>
      <form
        className="flex flex-col"
        style={{ gap: "var(--space-4)" }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          invite();
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setTouched(true)}
          error={touched ? emailError : null}
        />
        <Select
          label="Role"
          value={role}
          options={[
            { value: "admin", label: "Admin" },
            { value: "super_admin", label: "Super admin" },
          ]}
          onChange={(e) => setRole(e.target.value as InviteRole)}
          hint={
            role === "super_admin"
              ? "Can do everything an admin can, and invite, promote or deactivate other team members."
              : "Can work with leads, forms, hubs and content. Cannot manage the team."
          }
        />
        <Select
          label="Notifications"
          value={notifications}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          onChange={(e) => setNotifications(e.target.value as "yes" | "no")}
          hint="Whether they are emailed about new submissions, escalations and summaries. You can change this later."
        />

        {error && (
          <Alert tone="danger" title="Not invited">
            {error}
          </Alert>
        )}

        <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
