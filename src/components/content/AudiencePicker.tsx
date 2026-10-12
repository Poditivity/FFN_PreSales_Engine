"use client";

import { Button } from "@/components/ffn";
import type { Track } from "@/lib/content/types";

// Toggle-chip audience picker over the admin-managed tracks list. Empty
// selection means "every track" — the picker never forces one, matching the
// audience-empty-means-everyone convention every content type shares.
export function AudiencePicker({
  tracks,
  value,
  onChange,
}: {
  tracks: Track[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(trackId: string) {
    onChange(value.includes(trackId) ? value.filter((id) => id !== trackId) : [...value, trackId]);
  }

  if (tracks.length === 0) {
    return (
      <p className="caption" style={{ color: "var(--ink-subtle)" }}>
        No tracks yet — create one under Tracks to target specific audiences. Leaving this empty means
        visible to everyone.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
      {tracks.map((track) => (
        <Button
          key={track.id}
          type="button"
          size="sm"
          variant={value.includes(track.id) ? "primary" : "secondary"}
          onClick={() => toggle(track.id)}
        >
          {track.name}
        </Button>
      ))}
    </div>
  );
}
