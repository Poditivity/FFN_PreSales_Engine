"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Button, EmptyState, Select } from "@/components/ffn";
import { linkCoFounders, unlinkCoFounders, type CoFounderSummary } from "@/lib/content/founders";

interface FounderOption {
  id: string;
  name: string;
  startup_name: string | null;
}

export function CoFounderLinks({
  founderId,
  coFounders,
  allFounders,
}: {
  founderId: string;
  coFounders: CoFounderSummary[];
  allFounders: FounderOption[];
}) {
  const [linked, setLinked] = useState(coFounders);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => allFounders.filter((f) => !linked.some((c) => c.id === f.id)),
    [allFounders, linked],
  );

  async function addLink() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await linkCoFounders(founderId, picked);
      const founder = allFounders.find((f) => f.id === picked)!;
      setLinked((prev) => [...prev, { id: founder.id, name: founder.name, photo_url: null }]);
      setPicked("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link co-founder");
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(coFounderId: string) {
    setBusy(true);
    setError(null);
    try {
      await unlinkCoFounders(founderId, coFounderId);
      setLinked((prev) => prev.filter((c) => c.id !== coFounderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove co-founder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {linked.length === 0 ? (
        <EmptyState title="No co-founders linked" />
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {linked.map((c) => (
            <div key={c.id} className="flex items-center justify-between" style={{ padding: "var(--space-2) 0" }}>
              <span className="body-medium">{c.name}</span>
              <Button variant="ghost" size="sm" aria-label={`Remove ${c.name}`} onClick={() => removeLink(c.id)} disabled={busy}>
                <X size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {options.length > 0 && (
        <div className="flex items-end" style={{ gap: "var(--space-2)" }}>
          <Select
            label="Add a co-founder"
            value={picked}
            options={options.map((f) => ({ value: f.id, label: f.startup_name ? `${f.name} (${f.startup_name})` : f.name }))}
            placeholder="Choose a founder"
            onChange={(e) => setPicked(e.target.value)}
          />
          <Button onClick={addLink} disabled={!picked || busy} loading={busy}>
            Link
          </Button>
        </div>
      )}

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
    </div>
  );
}
