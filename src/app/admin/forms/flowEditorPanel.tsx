"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ffn";
import { fieldNeedsOptions, type FlowEdgeModel, type FlowNode } from "@/lib/forms/flowModel";
import { fileConfigOf, FIELD_TYPES, makeField, type FormField } from "@/lib/forms/formLogic";
import {
  FILE_CATEGORIES,
  FILE_CATEGORY_IDS,
  UPLOAD_HARD_MAX_MB,
  clampMaxMb,
  type FileCategory,
} from "../../../../supabase/functions/_shared/uploadRules";

// FFN-styled port of build-fellowship's superadmin/flowEditorPanel.jsx —
// the property panel for whatever is selected on the builder canvas.

const QUESTION_TYPES = FIELD_TYPES.filter((f) => f.type !== "section_header");

function PanelShell({
  title,
  onDelete,
  deletable = true,
  children,
}: {
  title: string;
  onDelete: () => void;
  deletable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex items-center justify-between">
        <span className="eyebrow" style={{ color: "var(--ink-muted)" }}>
          {title}
        </span>
        {deletable && (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete">
            <Trash2 size={15} />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function NodeFieldEditor({
  node,
  onChange,
  onDelete,
}: {
  node: FlowNode;
  onChange: (node: FlowNode) => void;
  onDelete: () => void;
}) {
  const field = node.data.field as FormField;
  const set = (patch: Partial<FormField>) => onChange({ ...node, data: { ...node.data, field: { ...field, ...patch } } });

  function changeType(newType: FormField["type"]) {
    const patch: Partial<FormField> = { type: newType };
    if (fieldNeedsOptions(newType) && (!field.options || field.options.length === 0)) {
      patch.options = ["Option 1", "Option 2"];
    }
    if (newType === "file" && !field.fileConfig) patch.fileConfig = makeField("file").fileConfig;
    set(patch);
  }

  const files = field.type === "file" ? fileConfigOf(field) : null;
  const setFiles = (patch: Partial<NonNullable<FormField["fileConfig"]>>) => files && set({ fileConfig: { ...files, ...patch } });
  const toggleCategory = (id: FileCategory) => {
    if (!files) return;
    const has = files.categories.includes(id);
    // At least one type must stay on, or nobody could upload anything.
    if (has && files.categories.length === 1) return;
    setFiles({ categories: FILE_CATEGORY_IDS.filter((c) => (c === id ? !has : files.categories.includes(c))) });
  };

  return (
    <PanelShell title="Question" onDelete={onDelete}>
      <Select
        size="sm"
        label="Answer type"
        value={field.type}
        options={QUESTION_TYPES.map((t) => ({ value: t.type, label: t.label }))}
        onChange={(e) => changeType(e.target.value as FormField["type"])}
      />
      <Input size="sm" label="Question / label" value={field.label} onChange={(e) => set({ label: e.target.value })} />
      <Input
        size="sm"
        label="Help text"
        value={field.helpText || ""}
        onChange={(e) => set({ helpText: e.target.value })}
      />
      <Input
        size="sm"
        label="Placeholder"
        value={field.placeholder || ""}
        onChange={(e) => set({ placeholder: e.target.value })}
      />
      <Checkbox
        label="Required"
        checked={!!field.required}
        onChange={(e) => set({ required: e.target.checked })}
      />

      {files && (
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <span className="label-sm" style={{ color: "var(--ink-muted)" }}>
            Accepted files
          </span>
          {FILE_CATEGORY_IDS.map((id) => (
            <Checkbox
              key={id}
              label={FILE_CATEGORIES[id].label}
              hint={FILE_CATEGORIES[id].hint}
              checked={files.categories.includes(id)}
              onChange={() => toggleCategory(id)}
            />
          ))}
          <Input
            size="sm"
            type="number"
            inputMode="numeric"
            min={1}
            max={UPLOAD_HARD_MAX_MB}
            label="Largest file (MB)"
            value={String(files.maxMb)}
            onChange={(e) => {
              // An emptied box keeps the last size while the next one is typed.
              if (e.target.value.trim() !== "") setFiles({ maxMb: clampMaxMb(e.target.value) });
            }}
            hint={`Up to ${UPLOAD_HARD_MAX_MB} MB per file.`}
          />
          <p className="caption" style={{ color: "var(--ink-subtle)" }}>
            Files go to Cloudflare R2 and are checked again on the server. Only the types ticked here are accepted.
          </p>
        </div>
      )}

      {fieldNeedsOptions(field.type) && (
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span className="label-sm" style={{ color: "var(--ink-muted)" }}>
            Options
          </span>
          {(field.options ?? []).map((opt, idx) => (
            <div key={idx} className="flex items-center" style={{ gap: "var(--space-2)" }}>
              <Input
                size="sm"
                value={opt}
                placeholder={`Option ${idx + 1}`}
                onChange={(e) => {
                  const next = [...(field.options ?? [])];
                  next[idx] = e.target.value;
                  set({ options: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = [...(field.options ?? [])];
                    next.splice(idx + 1, 0, "");
                    set({ options: next });
                  }
                }}
              />
              {(field.options ?? []).length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remove option"
                  onClick={() => set({ options: (field.options ?? []).filter((_, j) => j !== idx) })}
                >
                  <X size={13} />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            iconLeft={<Plus size={12} />}
            onClick={() => set({ options: [...(field.options ?? []), ""] })}
          >
            Add option
          </Button>
          <p className="caption" style={{ color: "var(--ink-subtle)" }}>
            Each option creates a branch handle on the canvas — drag its dot to the next question.
          </p>
        </div>
      )}
    </PanelShell>
  );
}

export function EndEditor({
  node,
  onChange,
  onDelete,
}: {
  node: FlowNode;
  onChange: (node: FlowNode) => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<FlowNode["data"]>) => onChange({ ...node, data: { ...node.data, ...patch } });
  return (
    <PanelShell title="End / outcome" onDelete={onDelete}>
      <Input
        size="sm"
        label="Label (shown on canvas)"
        value={node.data.label || ""}
        onChange={(e) => set({ label: e.target.value })}
      />
      <Textarea
        rows={3}
        label="Thank-you message (optional)"
        placeholder="Leave blank to use the form's default message"
        value={node.data.message || ""}
        onChange={(e) => set({ message: e.target.value })}
      />
      <Input
        size="sm"
        label="Redirect URL (optional)"
        placeholder="https://… (overrides the message)"
        value={node.data.redirect_url || ""}
        onChange={(e) => set({ redirect_url: e.target.value })}
      />
    </PanelShell>
  );
}

export function EdgeEditor({ edge, onDelete }: { edge: FlowEdgeModel; onDelete: () => void }) {
  const kind = edge.data?.kind || "always";
  return (
    <PanelShell title="Connection" onDelete={onDelete}>
      <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
        {kind === "option" && (
          <>
            This path is taken when the answer is <strong>&ldquo;{edge.data.value}&rdquo;</strong>.
          </>
        )}
        {kind === "else" && (
          <>
            This path is taken for <strong>any other answer</strong>.
          </>
        )}
        {kind === "always" && <>This path is always taken next.</>}
      </p>
      <p className="caption" style={{ color: "var(--ink-subtle)" }}>
        To change the trigger, delete this arrow and drag from a different option dot.
      </p>
    </PanelShell>
  );
}

export function EmptyPanel() {
  return (
    <p className="body-sm" style={{ color: "var(--ink-subtle)", lineHeight: 1.6 }}>
      Select a question, an outcome, or an arrow to edit it.
      <br />
      <br />
      <strong style={{ color: "var(--ink-muted)" }}>Tip:</strong> add a Choice/Dropdown question, then drag each
      option&rsquo;s dot to a different next question to branch the flow.
    </p>
  );
}
