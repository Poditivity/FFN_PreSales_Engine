"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  useUpdateNodeInternals,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { CheckCircle2, Flag } from "lucide-react";
import { useEffect } from "react";
import { isChoiceField } from "@/lib/forms/flowModel";
import type { FieldType } from "@/lib/forms/formLogic";

// FFN-styled port of build-fellowship's flowNodes.jsx (React Flow node/edge
// types for the visual builder canvas). Colors/spacing come from the FFN
// token set (tokens.css) instead of the source's bt-* Build Theory palette.

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  url: "URL",
  select: "Dropdown",
  multiselect: "Multi-select",
  radio: "Choice",
  date: "Date",
  rating: "Rating",
  file: "File upload",
  section_header: "Section",
};

const dot: React.CSSProperties = {
  width: 12,
  height: 12,
  background: "var(--surface)",
  border: "2px solid var(--border-strong)",
  cursor: "crosshair",
};
const dotActive: React.CSSProperties = { ...dot, border: "2px solid var(--brand-solid)" };

export function StartNode({ selected }: NodeProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: "var(--radius-full)",
        background: "var(--surface-inverse)",
        color: "var(--on-inverse)",
        fontSize: 13,
        fontWeight: 500,
        boxShadow: selected ? "0 0 0 2px var(--brand-solid)" : "var(--shadow-sm)",
      }}
    >
      <Flag size={14} /> Start
      <Handle type="source" position={Position.Bottom} id="out" style={dotActive} />
    </div>
  );
}

export function EndNode({ data, selected }: NodeProps) {
  const label = (data as { label?: string })?.label || "Finish";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: "var(--radius-lg)",
        background: "var(--success-surface)",
        color: "var(--success)",
        border: "1px solid var(--success-border)",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: selected ? "0 0 0 2px var(--brand-solid)" : "none",
        maxWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Top} id="in" style={dot} />
      <CheckCircle2 size={15} />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
}

export function QuestionNode({ id, data, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const field = (data as { field: { type: FieldType; label: string; required: boolean; options?: string[] } }).field;
  const choice = isChoiceField(field.type);
  const options = (field.options ?? []).filter(Boolean);

  // React Flow only scans handles on first render; re-register the handle
  // layout whenever options or the choice/non-choice handle set changes.
  const handleKey = `${field.type}|${options.join("|")}`;
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleKey, updateNodeInternals]);

  return (
    <div
      style={{
        width: 230,
        background: "var(--surface)",
        border: `1.5px solid ${selected ? "var(--brand-solid)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Handle type="target" position={Position.Top} id="in" style={dot} />

      <div style={{ padding: "10px 12px 8px" }}>
        <div className="eyebrow" style={{ color: "var(--ink-muted)", marginBottom: 4 }}>
          {TYPE_LABEL[field.type] || field.type}
          {field.required && <span style={{ color: "var(--danger)" }}> · required</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>
          {field.label || "Untitled question"}
        </div>
      </div>

      {choice && options.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "4px 0" }}>
          {options.map((opt) => (
            <div
              key={opt}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                padding: "6px 20px 6px 12px",
                fontSize: 12.5,
                color: "var(--ink-muted)",
              }}
            >
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt}</span>
              <Handle type="source" position={Position.Right} id={`opt:${opt}`} style={dotActive} />
            </div>
          ))}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              padding: "6px 20px 6px 12px",
              fontSize: 12,
              color: "var(--ink-subtle)",
              fontStyle: "italic",
            }}
          >
            <span>Any other answer</span>
            <Handle type="source" position={Position.Right} id="else" style={dot} />
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="out" style={dotActive} />
    </div>
  );
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const edgeData = data as { kind?: string; value?: string } | undefined;
  const label = edgeData?.kind === "option" ? edgeData.value : edgeData?.kind === "else" ? "else" : "";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: selected ? "var(--brand-solid)" : "var(--border-strong)", strokeWidth: selected ? 2 : 1.5 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              padding: "1px 8px",
              fontSize: 11,
              color: "var(--ink-muted)",
              pointerEvents: "all",
              whiteSpace: "nowrap",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const nodeTypes = { start: StartNode, question: QuestionNode, end: EndNode };
export const edgeTypes = { flow: FlowEdge };
