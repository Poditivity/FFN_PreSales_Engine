"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button, Input } from "@/components/ffn";

// Repeatable free-text tag list — used for every admin-typed array field
// across the Proof Layer (founder stages, industries, problems addressed,
// support formats, program stages, etc). Nothing here is ever required: an
// empty list is a valid, complete value.
export function TagListInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ marginBottom: "var(--space-2)" }}>
        <span className="label" id={`${listId}-label`}>
          {label}
        </span>
        {value.length > 0 && (
          <span className="data-sm" style={{ color: "var(--ink-subtle)" }}>
            {value.length}
          </span>
        )}
      </div>

      {value.length > 0 ? (
        <ul
          className="flex flex-wrap"
          aria-labelledby={`${listId}-label`}
          style={{ gap: "var(--space-2)", margin: "0 0 var(--space-3)", padding: 0, listStyle: "none" }}
        >
          {value.map((tag) => (
            <li key={tag} className="tag-chip body-sm">
              {tag}
              <button type="button" className="tag-chip__remove" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
                <X size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption" style={{ color: "var(--ink-subtle)", margin: "0 0 var(--space-2)" }}>
          Nothing added yet.
        </p>
      )}

      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            aria-labelledby={`${listId}-label`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" iconLeft={<Plus size={14} />} onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {hint && (
        <p className="caption" style={{ color: "var(--ink-subtle)", margin: "var(--space-1) 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
