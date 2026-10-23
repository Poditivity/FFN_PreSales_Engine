"use client";

import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Eye, Plus, Settings, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Alert, Button, Input, Select, Textarea } from "@/components/ffn";
import { FormRenderer } from "@/app/forms/[slug]/FormRenderer";
import { EdgeEditor, EmptyPanel, EndEditor, NAME_HINT, NodeFieldEditor } from "./flowEditorPanel";
import {
  edgeTypes,
  nodeTypes,
} from "@/components/forms/flowNodes";
import {
  brokenBranches,
  makeEdge,
  makeEndNode,
  makeQuestionNode,
  makeStartNode,
  normalizeSchema,
  serializeGraph,
  syncOptionEdges,
  type EdgeData,
  type FlowEdgeModel,
  type FlowNode,
} from "@/lib/forms/flowModel";
import { FIELD_TYPES, isDisplayType } from "@/lib/forms/formLogic";
import type { Form, FormStatus, PostSubmitAction } from "@/lib/forms/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { FormDeleteButton } from "./FormDeleteButton";

// FFN-styled port of build-fellowship's superadmin/FormBuilder.jsx — the
// visual React Flow graph editor. Node/edge model and save payload shape
// match the source; presentation uses FFN components/tokens throughout.

function slugify(title: string): string {
  return (title || "form")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** What applicants are told when the team leaves the thank-you message blank. The database requires some text. */
const DEFAULT_THANK_YOU = "Thank you for applying! We will be in touch soon.";

function generateFormSlug(title: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slugify(title) || "form"}-${suffix}`;
}

interface DraftForm {
  title: string;
  slug: string;
  description: string;
  status: FormStatus;
  post_submit_action: PostSubmitAction;
  thank_you_message: string;
  redirect_url: string;
}

function blankForm(): DraftForm {
  return {
    title: "",
    slug: "",
    description: "",
    status: "draft",
    post_submit_action: "message",
    thank_you_message: DEFAULT_THANK_YOU,
    redirect_url: "",
  };
}

function newGraph() {
  const start = makeStartNode({ x: 80, y: 60 });
  const q = makeQuestionNode("radio", { x: 60, y: 190 });
  const end = makeEndNode({ x: 120, y: 430 });
  return { nodes: [start, q, end], edges: [makeEdge("start", q.id, { kind: "always" })] };
}

const arrow = { markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--border-strong)" } };

type Selection = { kind: "node" | "edge"; id: string } | null;

function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelect,
  onPaneClick,
  addQuestion,
  addEnd,
  compact,
}: {
  compact: boolean;
  nodes: FlowNode[];
  edges: FlowEdgeModel[];
  onNodesChange: ReturnType<typeof useNodesState<FlowNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<FlowEdgeModel>>[2];
  onConnect: (c: Connection) => void;
  onSelect: (s: Selection) => void;
  onPaneClick: () => void;
  addQuestion: (type: (typeof FIELD_TYPES)[number]["type"], position: { x: number; y: number }) => void;
  addEnd: (position: { x: number; y: number }) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const place = useCallback(
    () => screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: 240 }),
    [screenToFlowPosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={arrow}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_e, n) => onSelect({ kind: "node", id: n.id })}
      onEdgeClick={(_e, ed) => onSelect({ kind: "edge", id: ed.id })}
      onPaneClick={onPaneClick}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      // Touch screens have no Control key and no scroll wheel, so one finger
      // pans and two fingers pinch-zoom there. Desktop keeps drag-to-move-nodes.
      panOnDrag={compact}
      zoomOnPinch
      selectionOnDrag={false}
      panActivationKeyCode="Control"
      zoomActivationKeyCode="Control"
      panOnScroll={!compact}
      selectionKeyCode={null}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      <Controls showInteractive={false} />
      {!compact && (
        <MiniMap pannable zoomable nodeColor="var(--border)" maskColor="var(--surface-sunken)" style={{ background: "var(--surface-sunken)" }} />
      )}

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 5,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "var(--space-3)",
          width: compact ? "min(260px, calc(100% - 24px))" : 176,
          maxHeight: "calc(100% - 24px)",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
          <div className="eyebrow" style={{ color: "var(--ink-muted)" }}>
            Add question
          </div>
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={paletteOpen}
              aria-label={paletteOpen ? "Hide question types" : "Show question types"}
              onClick={() => setPaletteOpen((o) => !o)}
            >
              {paletteOpen ? <X size={15} /> : <Plus size={15} />}
            </Button>
          )}
        </div>
        {(!compact || paletteOpen) && (
          <>
            <div className="flex flex-wrap" style={{ gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
              {FIELD_TYPES.filter((f) => !isDisplayType(f.type)).map((ft) => (
                <Button
                  key={ft.type}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    addQuestion(ft.type, place());
                    setPaletteOpen(false);
                  }}
                >
                  {ft.label}
                </Button>
              ))}
            </div>
            <div className="eyebrow" style={{ color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>
              Add content
            </div>
            <div className="flex flex-wrap" style={{ gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
              {FIELD_TYPES.filter((f) => isDisplayType(f.type)).map((ft) => (
                <Button
                  key={ft.type}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    addQuestion(ft.type, place());
                    setPaletteOpen(false);
                  }}
                >
                  {ft.label}
                </Button>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              block
              style={{ marginTop: "var(--space-2)" }}
              iconLeft={<Plus size={13} />}
              onClick={() => {
                addEnd(place());
                setPaletteOpen(false);
              }}
            >
              Outcome
            </Button>
          </>
        )}
      </div>
    </ReactFlow>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-3)",
        background: "color-mix(in srgb, var(--surface-inverse) 50%, transparent)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: wide ? "min(720px, 96vw)" : "min(460px, 96vw)",
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-4)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
          <h2 className="h2">{title}</h2>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FormBuilderInner({ initialForm, submissionCount }: { initialForm?: Form; submissionCount: number }) {
  const router = useRouter();
  const isNew = !initialForm;

  const [form, setForm] = useState<DraftForm>(() => ({
    ...blankForm(),
    ...(initialForm
      ? {
          title: initialForm.title,
          slug: initialForm.slug,
          description: initialForm.description ?? "",
          status: initialForm.status,
          post_submit_action: initialForm.post_submit_action,
          thank_you_message: initialForm.thank_you_message ?? "",
          redirect_url: initialForm.redirect_url ?? "",
        }
      : {}),
  }));
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeModel>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [titleMissing, setTitleMissing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Below the lg breakpoint the canvas and the property panel stack, and
  // the panel becomes a bottom sheet so it never pushes the canvas away.
  const compact = useMediaQuery("(max-width: 1023px)");

  useEffect(() => {
    if (isNew) {
      const g = newGraph();
      setNodes(g.nodes);
      setEdges(g.edges.map((e) => ({ ...e, ...arrow })));
      return;
    }
    const g = normalizeSchema(initialForm!.schema);
    setNodes(g.nodes);
    setEdges(g.edges.map((e) => ({ ...e, type: "flow", ...arrow })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFormField = (patch: Partial<DraftForm>) => setForm((f) => ({ ...f, ...patch }));

  const onConnect = useCallback(
    (conn: Connection) => {
      const sh = conn.sourceHandle || "out";
      const data: EdgeData = sh.startsWith("opt:")
        ? { kind: "option", value: sh.slice(4) }
        : sh === "else"
          ? { kind: "else" }
          : { kind: "always" };
      const newEdge: FlowEdgeModel = {
        id: `e_${crypto.randomUUID().slice(0, 8)}`,
        source: conn.source!,
        target: conn.target!,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
        type: "flow",
        data,
        ...arrow,
      };
      setEdges((eds) => {
        const cleaned = eds.filter((e) => !(e.source === conn.source && e.sourceHandle === sh));
        return addEdge(newEdge, cleaned);
      });
    },
    [setEdges],
  );

  function addQuestion(fieldType: (typeof FIELD_TYPES)[number]["type"], position: { x: number; y: number }) {
    const node = makeQuestionNode(fieldType, position);
    setNodes((ns) => ns.concat(node));
    setSelected({ kind: "node", id: node.id });
  }
  function addEnd(position: { x: number; y: number }) {
    const node = makeEndNode(position);
    setNodes((ns) => ns.concat(node));
    setSelected({ kind: "node", id: node.id });
  }

  const updateNode = (updated: FlowNode) => {
    // A branch is drawn from an option, so renaming or removing the option carries its branch along.
    const before = nodes.find((n) => n.id === updated.id)?.data.field?.options ?? [];
    const after = updated.data.field?.options ?? [];
    if (before !== after) setEdges((es) => syncOptionEdges(es, updated.id, before, after));
    setNodes((ns) => ns.map((n) => (n.id === updated.id ? updated : n)));
  };
  const deleteNode = (nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelected(null);
  };
  const deleteEdge = (edgeId: string) => {
    setEdges((es) => es.filter((e) => e.id !== edgeId));
    setSelected(null);
  };

  const hasName = nodes.some((n) => n.type === "question" && n.data.field?.type === "name");
  const selNode = selected?.kind === "node" ? nodes.find((n) => n.id === selected.id) ?? null : null;
  const selEdge = selected?.kind === "edge" ? edges.find((e) => e.id === selected.id) ?? null : null;

  /** Resolves true when the form was saved, so the settings dialog knows it can close. */
  async function handleSave(): Promise<boolean> {
    setError("");
    setJustSaved(false);
    if (!form.title.trim()) {
      setTitleMissing(true);
      setError("Give the form a title before saving.");
      return false;
    }
    // A branch for an option that no longer exists would leave anyone who picks that answer stuck.
    const broken = brokenBranches(nodes, edges);
    if (broken.length > 0) {
      setError(broken.join(" "));
      return false;
    }
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      // A typed address is tidied to lowercase letters, numbers and single hyphens, the
      // only shape the rest of the platform accepts. Blank means "make one from the title".
      const slug = (form.slug.trim() ? slugify(form.slug) : "") || generateFormSlug(form.title);
      const thankYou = form.thank_you_message.trim() || DEFAULT_THANK_YOU;
      const payload = {
        title: form.title.trim(),
        slug,
        description: form.description || null,
        status: form.status,
        schema: serializeGraph(nodes, edges),
        post_submit_action: form.post_submit_action,
        thank_you_message: thankYou,
        redirect_url: form.redirect_url || null,
      };
      if (isNew) {
        const { data, error: insertError } = await supabase.from("forms").insert(payload).select("id").single();
        if (insertError) throw insertError;
        router.push(`/admin/forms/${data.id}`);
        router.refresh();
        return true;
      }
      const { error: updateError } = await supabase.from("forms").update(payload).eq("id", initialForm!.id);
      if (updateError) throw updateError;
      setFormField({ slug: payload.slug, thank_you_message: thankYou });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between" style={{ gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div className="flex items-center" style={{ gap: "var(--space-3)", flex: 1, minWidth: 0 }}>
          <Button variant="secondary" size="sm" onClick={() => router.push("/admin/forms")} aria-label="Back">
            <ArrowLeft size={15} />
          </Button>
          <Input
            size="lg"
            aria-label="Form title"
            placeholder="Form title (required)"
            error={titleMissing && !form.title.trim() ? "Required" : undefined}
            value={form.title}
            onChange={(e) => {
              setFormField({ title: e.target.value });
              if (e.target.value.trim()) setTitleMissing(false);
            }}
            style={{ width: "100%", maxWidth: 420 }}
          />
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
          <Select
            size="sm"
            aria-label="Form status"
            value={form.status}
            options={[
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "closed", label: "Closed" },
            ]}
            onChange={(e) => setFormField({ status: e.target.value as FormStatus })}
          />
          <Button variant="secondary" size="sm" iconLeft={<Settings size={15} />} onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Eye size={15} />} onClick={() => setPreview(true)}>
            Preview
          </Button>
          {initialForm && (
            <FormDeleteButton
              id={initialForm.id}
              title={form.title}
              submissionCount={submissionCount}
              redirectTo="/admin/forms"
            />
          )}
          <span role="status" aria-live="polite" className="body-sm" style={{ marginLeft: "auto", color: "var(--success)", minWidth: "3.5rem" }}>
            {justSaved ? "Saved." : ""}
          </span>
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>

      {isNew && (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-3)" }}>
          Add a title to get started. You can add or edit the slug, description, thank you message and redirect URL in
          Settings, on this same screen.
        </p>
      )}

      {error && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <Alert tone="danger" title="Form not saved">
            {error}
          </Alert>
        </div>
      )}

      {/* flex-col on mobile: the graph canvas and its side panel don't fit
          side by side under ~1024px, so they stack — the canvas keeps its
          own explicit height (real estate to actually use the graph editor),
          the panel below it takes natural content height. On lg+, flexbox's
          default align-items: stretch makes the panel match the canvas's
          height automatically, so only the canvas needs a height set. */}
      <div className="flex flex-col lg:flex-row" style={{ gap: "var(--space-4)" }}>
        <div
          style={{
            // In the stacked layout a flexible basis of zero leaves the canvas with no definite height, so it is sized outright.
            flex: compact ? "none" : 1,
            width: compact ? "100%" : undefined,
            height: compact ? "calc(100dvh - 300px)" : "calc(100vh - 220px)",
            minHeight: compact ? 380 : 460,
            touchAction: "none",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            background: "var(--surface-sunken)",
          }}
        >
          <ReactFlowProvider>
            <Canvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelect={setSelected}
              onPaneClick={() => setSelected(null)}
              addQuestion={addQuestion}
              addEnd={addEnd}
              compact={compact}
            />
          </ReactFlowProvider>
        </div>

        {(!compact || selNode || selEdge) && (
          <div
            className="w-full lg:w-[clamp(220px,28vw,300px)]"
            style={{
              flex: "none",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-4)",
              overflowY: "auto",
              ...(compact
                ? {
                    position: "fixed",
                    left: "var(--space-2)",
                    right: "var(--space-2)",
                    bottom: "var(--space-2)",
                    zIndex: 60,
                    maxHeight: "62dvh",
                    boxShadow: "var(--shadow-lg)",
                  }
                : {}),
            }}
          >
            {compact && (
              <div className="flex justify-end" style={{ marginBottom: "var(--space-2)" }}>
                <Button variant="ghost" size="sm" aria-label="Close editor" onClick={() => setSelected(null)}>
                  <X size={16} />
                </Button>
              </div>
            )}
            {selNode && selNode.type === "question" && (
              <NodeFieldEditor node={selNode} onChange={updateNode} onDelete={() => deleteNode(selNode.id)} />
            )}
            {selNode && selNode.type === "end" && (
              <EndEditor node={selNode} onChange={updateNode} onDelete={() => deleteNode(selNode.id)} hasName={hasName} />
            )}
            {selEdge && <EdgeEditor edge={selEdge} onDelete={() => deleteEdge(selEdge.id)} />}
            {!selNode && !selEdge && <EmptyPanel />}
          </div>
        )}
      </div>

      {settingsOpen && (
        <Modal title="Form settings" onClose={() => setSettingsOpen(false)}>
          <Input label="Slug" value={form.slug} onChange={(e) => setFormField({ slug: e.target.value })} placeholder="auto on save" />
          <Textarea
            rows={2}
            label="Description"
            value={form.description}
            onChange={(e) => setFormField({ description: e.target.value })}
          />
          <Select
            label="After submission"
            value={form.post_submit_action}
            options={[
              { value: "message", label: "Show a thank-you message" },
              { value: "redirect", label: "Redirect to a URL" },
            ]}
            onChange={(e) => setFormField({ post_submit_action: e.target.value as PostSubmitAction })}
          />
          <Textarea
            rows={2}
            label="Default thank-you message"
            hint={hasName ? NAME_HINT : undefined}
            value={form.thank_you_message}
            onChange={(e) => setFormField({ thank_you_message: e.target.value })}
          />
          <Input
            label="Default redirect URL (optional)"
            value={form.redirect_url}
            onChange={(e) => setFormField({ redirect_url: e.target.value })}
            placeholder="https://…"
          />
          <p className="caption" style={{ color: "var(--ink-subtle)" }}>
            Per-outcome messages/redirects (set on an End node) override these defaults.
          </p>
          {error && (
            <Alert tone="danger" title="Form not saved">
              {error}
            </Alert>
          )}
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setSettingsOpen(false)} disabled={saving}>
              Close
            </Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (await handleSave()) setSettingsOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title="Preview" wide onClose={() => setPreview(false)}>
          <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-xl)", padding: compact ? "var(--space-2)" : "var(--space-6)" }}>
            <FormRenderer
              form={{
                id: initialForm?.id ?? "preview",
                title: form.title,
                slug: form.slug || "preview",
                status: form.status,
                schema: serializeGraph(nodes, edges),
                description: form.description,
                thank_you_message: form.thank_you_message,
                post_submit_action: form.post_submit_action,
                redirect_url: form.redirect_url,
              }}
              preview
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function FormBuilder({ initialForm, submissionCount = 0 }: { initialForm?: Form; submissionCount?: number }) {
  return <FormBuilderInner initialForm={initialForm} submissionCount={submissionCount} />;
}
