// hub-hydrate — public, token-authenticated. Hydrates a hub for viewing
// (action: 'info') and batch-logs engagement events (action: 'track').
//
// No public RLS policy exists on hubs/hub_templates/hub_events/the Phase 3
// content tables (nor on ffn_profile/programs, added for the Proof Layer
// expansion) — every read and write here goes through the service role,
// with the hub's token standing in for auth (same shape as build-fellowship's
// real ax-hub edge function, examined directly for this phase's design).
//
// Module-resolution/eligibility logic is duplicated here (not imported from
// src/lib/hubs) because this Deno function can't reach into the Next app's
// source tree — same reason send-submission-email/hub-send reimplement
// small pure helpers instead of importing them. Keep this in sync with
// src/lib/hubs/modules.ts if either changes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { resolveHubIdentity } from "../_shared/hubIdentity.ts";
import { hasVisibleText, sanitizeEmailHtml } from "../_shared/messageText.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Any = Record<string, unknown> & { id: string };

// The columns of a hub this function reads. A draft fills the same shape.
interface HubRow {
  id: string;
  token: string;
  status: string;
  open_count: number;
  first_opened_at: string | null;
  lead_id: string | null;
  track_id: string;
  template_id: string | null;
  modules: unknown;
  startup_name: string | null;
  founder_stage: string | null;
  current_context: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_whatsapp: string | null;
}

interface HubModuleLink {
  label: string;
  url: string;
}

interface HubModule {
  type: string;
  // Custom and collection sections only (see src/lib/hubs/types.ts).
  id?: string;
  body?: string | null;
  image_url?: string | null;
  button_label?: string | null;
  button_url?: string | null;
  collection_id?: string | null;
  enabled: boolean;
  title: string | null;
  subtitle: string | null;
  mode: "auto" | "manual";
  ids: string[];
  featured_only: boolean;
  limit: number | null;
  links: HubModuleLink[];
}

// Singleton blocks (welcome, about, who_for, helps_with, how_supports,
// credibility, cta) — backed by ffn_profile / the hub's own
// Lead Context fields / hub_settings' CTA fields, never a filterable list —
// are omitted from the response entirely when they have nothing non-empty
// to show (see hasContent below). This is the same "hide if empty" rule the
// five original content-list blocks already apply client-side (blocks.tsx
// returns null for an empty items array), just enforced here instead since
// there's no item list for the client to check.

// True if at least one field on the payload (besides type/title/subtitle)
// has real content — a non-empty string or a non-empty array. Used to
// decide whether a singleton block belongs in the response at all.
function hasContent(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

// Links and images a staff member typed into a custom section go into the page as
// they are, so only an http or https address is let through.
function safeHttpUrl(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!/^https?:\/\//i.test(v)) return null;
  try {
    return new URL(v).toString();
  } catch {
    return null;
  }
}

function resolveModules(hubModules: HubModule[] | null, templateModules: HubModule[]): HubModule[] {
  return hubModules !== null ? hubModules : templateModules;
}

function isVisibleToTrack(audience: string[] | null | undefined, trackId: string): boolean {
  if (!audience || audience.length === 0) return true;
  return audience.includes(trackId);
}

// Hand-picked (manual) mode bypasses audience/featured/limit entirely —
// ticked ids alone decide membership and order. Automatic mode applies
// audience, then featured_only, then limit, in that order. Both modes only
// ever operate on rows already filtered to visibility = 'public' by the
// caller, so a draft item can never surface regardless of mode.
function resolveEligible(items: Any[], mod: HubModule, trackId: string): Any[] {
  if (mod.mode === "manual") {
    const order = new Map(mod.ids.map((id, i) => [id, i]));
    return items
      .filter((item) => order.has(item.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  let eligible = items.filter((item) => isVisibleToTrack(item.audience as string[], trackId));
  if (mod.featured_only) eligible = eligible.filter((item) => item.featured === true);
  if (mod.limit != null) eligible = eligible.slice(0, mod.limit);
  return eligible;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    action?: string;
    token?: string;
    preview?: boolean;
    session_id?: string;
    events?: Any[];
    draft?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // A draft is a hub that has not been created yet: staff preview what the
  // create-hub dialog is about to make. Nothing is read from or written to the
  // hubs table, and it is staff only because there is no token to vouch for it.
  const isDraft = body.action === "draft";
  let hub: HubRow;
  if (isDraft) {
    const caller = await requireStaff(req, admin);
    if (!caller.ok) return json({ error: "Staff only" }, 403);
    const d = body.draft ?? {};
    if (!d.track_id) return json({ error: "track_id is required" }, 400);
    hub = {
      id: "draft",
      token: "",
      status: "draft",
      open_count: 0,
      first_opened_at: null,
      lead_id: (d.lead_id as string | null) ?? null,
      track_id: String(d.track_id),
      template_id: (d.template_id as string | null) ?? null,
      modules: Array.isArray(d.modules) ? d.modules : null,
      startup_name: (d.startup_name as string | null) ?? null,
      founder_stage: (d.founder_stage as string | null) ?? null,
      current_context: (d.current_context as string | null) ?? null,
      applicant_name: (d.applicant_name as string | null) ?? null,
      applicant_email: (d.applicant_email as string | null) ?? null,
      applicant_whatsapp: (d.applicant_whatsapp as string | null) ?? null,
    };
  } else {
    const token = String(body.token ?? "");
    if (!token) return json({ error: "token is required" }, 400);
    const { data, error: hubError } = await admin.from("hubs").select("*").eq("token", token).maybeSingle();
    if (hubError || !data) return json({ error: "Hub not found" }, 404);
    hub = data;
  }
  const isPreview = isDraft || body.preview === true;

  if (body.action === "track") {
    if (isPreview) return json({ ok: true, skipped: "preview" });
    const events = (body.events ?? []).slice(0, 60);
    if (events.length === 0) return json({ ok: true });
    const rows = events.map((e) => ({
      hub_id: hub.id,
      session_id: String(body.session_id ?? ""),
      type: String(e.type ?? ""),
      target_type: e.target_type ?? null,
      target_id: e.target_id ?? null,
      meta: e.meta ?? null,
    }));
    const { error } = await admin.from("hub_events").insert(rows);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action !== "info" && !isDraft) return json({ error: "Unknown action" }, 400);

  const [{ data: track }, { data: template }] = await Promise.all([
    admin.from("tracks").select("id, name").eq("id", hub.track_id).maybeSingle(),
    hub.template_id
      ? admin.from("hub_templates").select("*").eq("id", hub.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!track) return json({ error: "Track not found" }, 404);

  const modules = resolveModules(
    (hub.modules ?? null) as HubModule[] | null,
    ((template?.modules ?? []) as HubModule[]),
  ).filter((m) => m.enabled);

  const trackId = hub.track_id as string;
  const blocks: Any[] = [];

  for (const mod of modules) {
    if (mod.type === "welcome") {
      const { name: leadName } = await resolveHubIdentity(hub);
      const fields = {
        lead_name: leadName || null,
        startup_name: (hub.startup_name as string | null) ?? null,
        founder_stage: (hub.founder_stage as string | null) ?? null,
        current_context: (hub.current_context as string | null) ?? null,
      };
      if (hasContent(fields)) {
        blocks.push({ type: "welcome", title: mod.title, subtitle: mod.subtitle, ...fields });
      }
    } else if (mod.type === "about") {
      const { data: profile } = await admin
        .from("ffn_profile")
        .select("one_liner, helps_founders_do, approach, differentiator, website_url")
        .eq("id", true)
        .maybeSingle();
      const fields = {
        one_liner: profile?.one_liner ?? null,
        helps_founders_do: profile?.helps_founders_do ?? null,
        approach: profile?.approach ?? null,
        differentiator: profile?.differentiator ?? null,
        website_url: profile?.website_url ?? null,
      };
      if (hasContent(fields)) blocks.push({ type: "about", title: mod.title, subtitle: mod.subtitle, ...fields });
    } else if (mod.type === "who_for") {
      const { data: profile } = await admin
        .from("ffn_profile")
        .select("founder_stages_supported, startup_stages_supported, founder_types, industries")
        .eq("id", true)
        .maybeSingle();
      const fields = {
        founder_stages_supported: profile?.founder_stages_supported ?? [],
        startup_stages_supported: profile?.startup_stages_supported ?? [],
        founder_types: profile?.founder_types ?? [],
        industries: profile?.industries ?? [],
      };
      if (hasContent(fields)) blocks.push({ type: "who_for", title: mod.title, subtitle: mod.subtitle, ...fields });
    } else if (mod.type === "helps_with") {
      const { data: profile } = await admin.from("ffn_profile").select("problems_addressed").eq("id", true).maybeSingle();
      const fields = { problems_addressed: profile?.problems_addressed ?? [] };
      if (hasContent(fields)) blocks.push({ type: "helps_with", title: mod.title, subtitle: mod.subtitle, ...fields });
    } else if (mod.type === "how_supports") {
      const { data: profile } = await admin.from("ffn_profile").select("support_formats").eq("id", true).maybeSingle();
      const fields = { support_formats: profile?.support_formats ?? [] };
      if (hasContent(fields)) blocks.push({ type: "how_supports", title: mod.title, subtitle: mod.subtitle, ...fields });
    } else if (mod.type === "programs") {
      const { data: programs } = await admin
        .from("programs")
        .select("id, name, description, stages, problems_addressed, audience, featured")
        .eq("visibility", "public");
      const eligible = resolveEligible((programs ?? []) as Any[], mod, trackId);
      blocks.push({
        type: "programs",
        title: mod.title,
        subtitle: mod.subtitle,
        programs: eligible.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          stages: p.stages,
          problems_addressed: p.problems_addressed,
        })),
      });
    } else if (mod.type === "founders") {
      const { data: founders } = await admin
        .from("founders")
        .select(
          "id, name, photo_url, startup_name, startup_logo_url, website_url, linkedin_url, starting_stage, current_stage, industry, starting_problem, journey, ffn_support, key_change, outcome, milestones, professional_experience, audience, featured",
        )
        .eq("visibility", "public");
      const eligible = resolveEligible((founders ?? []) as Any[], mod, trackId);
      const ids = eligible.map((f) => f.id);
      let coFounderMap = new Map<string, { id: string; name: string }[]>();
      if (ids.length > 0) {
        const { data: links } = await admin
          .from("founder_co_founder_links")
          .select("founder_id, co_founder_id")
          .in("founder_id", ids);
        const coIds = [...new Set((links ?? []).map((l) => l.co_founder_id as string))];
        if (coIds.length > 0) {
          const { data: coFounders } = await admin.from("founders").select("id, name").in("id", coIds);
          const byId = new Map((coFounders ?? []).map((f) => [f.id as string, f as { id: string; name: string }]));
          coFounderMap = new Map();
          for (const link of links ?? []) {
            const co = byId.get(link.co_founder_id as string);
            if (!co) continue;
            const list = coFounderMap.get(link.founder_id as string) ?? [];
            list.push(co);
            coFounderMap.set(link.founder_id as string, list);
          }
        }
      }
      blocks.push({
        type: "founders",
        title: mod.title,
        subtitle: mod.subtitle,
        founders: eligible.map((f) => ({
          id: f.id,
          name: f.name,
          photo_url: f.photo_url,
          startup_name: f.startup_name,
          startup_logo_url: f.startup_logo_url,
          website_url: f.website_url,
          linkedin_url: f.linkedin_url,
          starting_stage: f.starting_stage,
          current_stage: f.current_stage,
          industry: f.industry,
          starting_problem: f.starting_problem,
          journey: f.journey,
          ffn_support: f.ffn_support,
          key_change: f.key_change,
          outcome: f.outcome,
          milestones: f.milestones,
          professional_experience: f.professional_experience,
          co_founders: coFounderMap.get(f.id) ?? [],
        })),
      });
    } else if (mod.type === "case_studies") {
      const { data: caseStudies } = await admin
        .from("case_studies")
        .select("id, title, case_study_link, audience, featured, case_study_founders(founder_id, sort_order, founders(id, name))")
        .eq("visibility", "public");
      const eligible = resolveEligible((caseStudies ?? []) as Any[], mod, trackId);
      blocks.push({
        type: "case_studies",
        title: mod.title,
        subtitle: mod.subtitle,
        case_studies: eligible.map((cs) => ({
          id: cs.id,
          title: cs.title,
          case_study_link: cs.case_study_link,
          founders: ((cs.case_study_founders as Any[]) ?? [])
            .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
            .map((row) => row.founders)
            .filter(Boolean),
        })),
      });
    } else if (mod.type === "testimonials") {
      const { data: testimonials } = await admin
        .from("testimonials")
        .select("id, testimonial_quote, video_link, audience, featured, founders:founder_id(id, name, photo_url, startup_name, startup_logo_url)")
        .eq("visibility", "public");
      const eligible = resolveEligible((testimonials ?? []) as Any[], mod, trackId);

      // A founder is a co-founder when another founder shares their startup or
      // is linked to them as one. The label on a testimonial reads
      // "Co-Founder, Startup" then, and "Founder, Startup" otherwise.
      const speakers = eligible.map((t) => t.founders as { id: string; name: string; startup_name: string | null } | null).filter(Boolean) as {
        id: string;
        name: string;
        startup_name: string | null;
      }[];
      const startupNames = [...new Set(speakers.map((f) => f.startup_name?.trim()).filter(Boolean))] as string[];
      const perStartup = new Map<string, number>();
      if (startupNames.length > 0) {
        const { data: sameStartup } = await admin.from("founders").select("id, startup_name").in("startup_name", startupNames);
        for (const row of sameStartup ?? []) {
          const key = String(row.startup_name ?? "").trim().toLowerCase();
          perStartup.set(key, (perStartup.get(key) ?? 0) + 1);
        }
      }
      const linked = new Set<string>();
      if (speakers.length > 0) {
        const ids = speakers.map((f) => f.id);
        const [{ data: out }, { data: inn }] = await Promise.all([
          admin.from("founder_co_founder_links").select("founder_id").in("founder_id", ids),
          admin.from("founder_co_founder_links").select("co_founder_id").in("co_founder_id", ids),
        ]);
        for (const l of out ?? []) linked.add(l.founder_id as string);
        for (const l of inn ?? []) linked.add(l.co_founder_id as string);
      }
      blocks.push({
        type: "testimonials",
        title: mod.title,
        subtitle: mod.subtitle,
        testimonials: eligible.map((t) => ({
          id: t.id,
          testimonial_quote: t.testimonial_quote,
          video_link: t.video_link,
          founder: t.founders
            ? {
                ...(t.founders as { id: string; name: string; startup_name: string | null }),
                is_co_founder:
                  linked.has((t.founders as { id: string }).id) ||
                  (perStartup.get(String((t.founders as { startup_name: string | null }).startup_name ?? "").trim().toLowerCase()) ?? 0) > 1,
              }
            : null,
        })),
      });
    } else if (mod.type === "mentors") {
      const { data: mentors } = await admin
        .from("mentors")
        .select("id, name, photo_url, role, expertise, relevant_experience, linkedin_url, audience, featured")
        .eq("visibility", "public");
      const eligible = resolveEligible((mentors ?? []) as Any[], mod, trackId);
      blocks.push({
        type: "mentors",
        title: mod.title,
        subtitle: mod.subtitle,
        mentors: eligible.map((m) => ({
          id: m.id,
          name: m.name,
          photo_url: m.photo_url,
          role: m.role,
          expertise: m.expertise,
          relevant_experience: m.relevant_experience,
          linkedin_url: m.linkedin_url,
        })),
      });
    } else if (mod.type === "credibility") {
      const { data: profile } = await admin
        .from("ffn_profile")
        .select("credibility_founders_stat, credibility_programs_stat, credibility_events_stat, credibility_partnerships_stat")
        .eq("id", true)
        .maybeSingle();
      const fields = {
        founders_stat: profile?.credibility_founders_stat ?? null,
        programs_stat: profile?.credibility_programs_stat ?? null,
        events_stat: profile?.credibility_events_stat ?? null,
        partnerships_stat: profile?.credibility_partnerships_stat ?? null,
      };
      if (hasContent(fields)) blocks.push({ type: "credibility", title: mod.title, subtitle: mod.subtitle, ...fields });
    } else if (mod.type === "links") {
      const links = (mod.links ?? []).filter((l) => l.label?.trim() && l.url?.trim());
      blocks.push({ type: "links", title: mod.title, subtitle: mod.subtitle, links });
    } else if (mod.type === "faqs") {
      const { data: faqs } = await admin
        .from("faqs")
        .select("id, question, answer, audience, featured")
        .eq("visibility", "public");
      const eligible = resolveEligible((faqs ?? []) as Any[], mod, trackId);
      blocks.push({
        type: "faqs",
        title: mod.title,
        subtitle: mod.subtitle,
        faqs: eligible.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
      });
    } else if (mod.type === "custom") {
      // A section staff write themselves: a heading, rich text, an image and a button.
      // The text is cleaned here as well as in the editor, so a stored body can never
      // carry a script or a hostile link onto the page.
      const body = sanitizeEmailHtml(mod.body ?? "");
      const imageUrl = safeHttpUrl(mod.image_url);
      const buttonUrl = safeHttpUrl(mod.button_url);
      const buttonLabel = (mod.button_label ?? "").trim();
      const hasText = hasVisibleText(body);
      // Nothing to show: an empty section would be a heading over blank space.
      if (hasText || imageUrl) {
        blocks.push({
          type: "custom",
          key: mod.id,
          title: mod.title,
          subtitle: mod.subtitle,
          body: hasText ? body : null,
          image_url: imageUrl,
          button_label: buttonUrl && buttonLabel ? buttonLabel : null,
          button_url: buttonUrl && buttonLabel ? buttonUrl : null,
        });
      }
    } else if (mod.type === "collection") {
      if (!mod.collection_id) continue;
      const { data: items } = await admin
        .from("content_collection_items")
        .select("id, title, description, image_url, link_url, audience, featured")
        .eq("collection_id", mod.collection_id)
        .eq("visibility", "public")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      const eligible = resolveEligible((items ?? []) as Any[], mod, trackId);
      blocks.push({
        type: "collection",
        key: mod.id,
        title: mod.title,
        subtitle: mod.subtitle,
        items: eligible.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          image_url: safeHttpUrl(i.image_url as string | null),
          link_url: safeHttpUrl(i.link_url as string | null),
        })),
      });
    } else if (mod.type === "cta") {
      const { data: settings } = await admin
        .from("hub_settings")
        .select("cta_text, booking_url")
        .eq("id", true)
        .maybeSingle();
      const fields = {
        cta_text: settings?.cta_text ?? null,
        booking_url: settings?.booking_url ?? null,
      };
      // The block is a button to the booking link, so with no link there is nothing to show.
      if (fields.booking_url) blocks.push({ type: "cta", title: mod.title, subtitle: mod.subtitle, ...fields });
    }
  }

  // Opened-status guard: only promote draft/sent -> opened, never downgrade
  // an already-opened (or later-stage) hub back. open_count/last_opened_at
  // update on every non-preview view regardless of status; first_opened_at
  // is set-once. Entirely skipped in preview mode — a staff preview must
  // never pollute open-rate data.
  let responseStatus = hub.status as string;
  let responseOpenCount = hub.open_count as number;
  if (!isPreview) {
    const now = new Date().toISOString();
    const patch: Any & { status?: string } = {
      open_count: (hub.open_count as number) + 1,
      last_opened_at: now,
      first_opened_at: (hub.first_opened_at as string | null) ?? now,
    } as Any;
    if (hub.status === "draft" || hub.status === "sent") patch.status = "opened";
    try {
      await admin.from("hubs").update(patch).eq("id", hub.id);
      responseStatus = (patch.status as string) ?? responseStatus;
      responseOpenCount = patch.open_count as number;
    } catch {
      // counters are best-effort — must never block rendering the hub
    }
  }

  return json({
    track: { id: track.id, name: track.name },
    status: responseStatus,
    open_count: responseOpenCount,
    blocks,
    // Per template. A hub with no template, or a template saved before the setting existed, keeps the bar.
    show_navbar: template?.show_navbar !== false,
  });
});
