"use client";

import { useState } from "react";
import { Alert, Button, Card, Checkbox, Select } from "@/components/ffn";
import { deleteStageEmailRule, upsertStageEmailRule } from "@/lib/emailEngine/rules";
import type { EmailTemplate, StageEmailRule } from "@/lib/emailEngine/types";
import { OFF_PATH_STAGES, PIPELINE_STAGES } from "@/lib/leads/schema";

// The path stages, then Nurture: a lead moved to Nurture can get an email (it is off by
// default, like every rule). Dormant and lost are not offered, since nothing should be
// sent to a lead who has gone quiet or been declined.
const RULE_STAGES = [...PIPELINE_STAGES, ...OFF_PATH_STAGES.filter((s) => s.id === "nurture")];

export function StageEmailRulesManager({
  initialRules,
  templates,
}: {
  initialRules: StageEmailRule[];
  templates: EmailTemplate[];
}) {
  const [rules, setRules] = useState(initialRules);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      {RULE_STAGES.map((stage) => {
        const rule = rules.find((r) => r.stage === stage.id) ?? null;
        return (
          <StageRuleRow
            key={stage.id}
            stageLabel={stage.label}
            stageId={stage.id}
            rule={rule}
            templates={templates}
            onSaved={(saved) => {
              setRules((prev) => (prev.some((r) => r.stage === saved.stage) ? prev.map((r) => (r.stage === saved.stage ? saved : r)) : [...prev, saved]));
            }}
            onCleared={() => setRules((prev) => prev.filter((r) => r.stage !== stage.id))}
          />
        );
      })}
    </div>
  );
}

function StageRuleRow({
  stageLabel,
  stageId,
  rule,
  templates,
  onSaved,
  onCleared,
}: {
  stageLabel: string;
  stageId: StageEmailRule["stage"];
  rule: StageEmailRule | null;
  templates: EmailTemplate[];
  onSaved: (rule: StageEmailRule) => void;
  onCleared: () => void;
}) {
  const [templateId, setTemplateId] = useState(rule?.template_id ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = templateId !== (rule?.template_id ?? "") || enabled !== (rule?.enabled ?? false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!templateId) {
        await deleteStageEmailRule(stageId);
        onCleared();
        setEnabled(false);
      } else {
        const saved = await upsertStageEmailRule({ stage: stageId, template_id: templateId, enabled });
        onSaved(saved);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-4)" }}>
        <div style={{ minWidth: 140 }}>
          <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
            Stage
          </span>
          <p className="body-medium">{stageLabel}</p>
        </div>
        <Select
          label="Template"
          value={templateId}
          placeholder="No template — nothing sends"
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(e) => setTemplateId(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <Checkbox
          label="Enabled"
          hint="Sends automatically on this stage move"
          checked={enabled}
          disabled={!templateId}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
      {error && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        </div>
      )}
    </Card>
  );
}
