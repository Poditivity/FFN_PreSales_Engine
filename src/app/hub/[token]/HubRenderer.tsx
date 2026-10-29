"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLockup } from "@/components/BrandLockup";
import { HubSkeleton } from "@/components/ffn/PublicSkeletons";
import { fetchHubDraftInfo, fetchHubInfo, readHubDraft, type HubBlockPayload, type HubCaseStudyItem, type HubInfoPayload } from "@/lib/hubs/publicHub";
import { useHubTracker, useSectionEngagement } from "@/lib/hubs/tracker";
import { BLOCK_LABELS, type BlockType, type ModuleType } from "@/lib/hubs/types";
import {
  AboutBlock,
  CaseStudiesBlock,
  CredibilityBlock,
  CtaBlock,
  FaqsBlock,
  FoundersBlock,
  HelpsWithBlock,
  HowSupportsBlock,
  LinksBlock,
  MentorsBlock,
  ProgramsBlock,
  TestimonialsBlock,
  WhoForBlock,
} from "./blocks";
import { CollectionBlock, CustomBlock } from "./customBlocks";
import { FounderDrawer } from "./FounderDrawer";
import { HUB_CSS } from "./hubStyles";

function sessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "ffn_hub_session_id";
  let sid = window.sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    window.sessionStorage.setItem(key, sid);
  }
  return sid;
}

// The bar carries only the sections an applicant comes here for, the proof.
// Everything else is still on the page, one scroll away. Order follows the page.
const NAV_TYPES: readonly ModuleType[] = ["programs", "founders", "case_studies", "testimonials", "mentors"];

/** The id of a block's section on the page: its own id for a custom or collection section, its type otherwise. */
const sectionIdOf = (block: HubBlockPayload): string => block.key ?? block.type;

/** Whether a block will draw anything. A link to a section that draws nothing would go nowhere. */
function draws(block: HubBlockPayload): boolean {
  switch (block.type) {
    case "welcome":
      return false; // It is the hero, not a section of its own.
    case "founders":
      return (block.founders?.length ?? 0) > 0;
    case "case_studies":
      return (block.case_studies?.length ?? 0) > 0;
    case "testimonials":
      return (block.testimonials ?? []).some((t) => t.testimonial_quote || t.video_link);
    case "mentors":
      return (block.mentors?.length ?? 0) > 0;
    case "programs":
      return (block.programs?.length ?? 0) > 0;
    case "faqs":
      return (block.faqs?.length ?? 0) > 0;
    case "links":
      return (block.links?.length ?? 0) > 0;
    case "helps_with":
      return (block.problems_addressed?.length ?? 0) > 0;
    case "how_supports":
      return (block.support_formats?.length ?? 0) > 0;
    case "who_for":
      return (
        (block.founder_stages_supported?.length ?? 0) +
          (block.startup_stages_supported?.length ?? 0) +
          (block.founder_types?.length ?? 0) +
          (block.industries?.length ?? 0) >
        0
      );
    case "cta":
      return Boolean(block.booking_url);
    case "custom":
      return Boolean(block.body || block.image_url);
    case "collection":
      return (block.items?.length ?? 0) > 0;
    case "credibility":
      return Boolean(block.founders_stat || block.programs_stat || block.events_stat || block.partnerships_stat);
    default:
      return true;
  }
}

function State({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="ffn-hub">
      <style>{HUB_CSS}</style>
      <div className="hub-state">
        <BrandLockup />
        {title && <p className="hub-state-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function HubRenderer({ token }: { token: string }) {
  const searchParams = useSearchParams();
  // A draft preview is a hub that has not been created yet (staff only, from the
  // create-hub dialog). It is always a preview, so it is never tracked.
  const draftKey = searchParams.get("draft");
  const preview = searchParams.get("preview") === "1" || draftKey !== null;
  const [session] = useState(sessionId);
  const [data, setData] = useState<HubInfoPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [founderId, setFounderId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const { track, flush } = useHubTracker(token, session, preview);
  const sectionIds = useMemo(() => (data ? data.blocks.filter(draws).map(sectionIdOf) : []), [data]);
  useSectionEngagement(track, sectionIds);

  useEffect(() => {
    let request: Promise<HubInfoPayload>;
    if (draftKey !== null) {
      const draft = readHubDraft(draftKey);
      request = draft
        ? fetchHubDraftInfo(draft)
        : Promise.reject(new Error("This preview has expired. Go back to the dialog and preview again."));
    } else {
      request = fetchHubInfo(token, preview);
    }
    request
      .then((info) => {
        setData(info);
        track("hub_view");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "This page could not be loaded."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, preview, draftKey]);

  // The bar gains a line once the page moves, and the link for the section being
  // read is marked: the last section whose top has passed the upper part of the window.
  useEffect(() => {
    if (!data) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [data, sectionIds]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Opening a case study brings the reader into view.
  useEffect(() => {
    if (!caseId) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("case-reader")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [caseId]);

  const byType = useMemo(() => new Map((data?.blocks ?? []).map((b) => [b.type, b])), [data]);
  const founders = byType.get("founders")?.founders ?? [];
  const caseStudies = byType.get("case_studies")?.case_studies ?? [];
  const testimonials = byType.get("testimonials")?.testimonials ?? [];

  const openCaseStudy = useCallback(
    (item: HubCaseStudyItem) => {
      setCaseId(item.id);
      track("view", "case_studies", item.id);
    },
    [track],
  );
  const closeCaseStudy = useCallback(() => setCaseId(null), []);
  const closeFounder = useCallback(() => setFounderId(null), []);

  if (error) {
    return (
      <State title="This page is not available.">
        <p className="hub-state-text">{error}</p>
      </State>
    );
  }
  if (!data) {
    return <HubSkeleton />;
  }

  const welcome = byType.get("welcome");
  const cta = byType.get("cta");
  const bookingUrl = cta?.booking_url ?? null;
  // The bar carries the proof sections. The Sections menu lists those and the
  // sections staff added, in page order.
  const drawn = data.blocks.filter(draws);
  const navSections = drawn
    .filter((b) => NAV_TYPES.includes(b.type))
    .map((b) => ({ id: sectionIdOf(b), label: BLOCK_LABELS[b.type as BlockType] }));
  const menuSections = drawn
    .filter((b) => NAV_TYPES.includes(b.type) || b.type === "custom" || b.type === "collection")
    .map((b) => ({
      id: sectionIdOf(b),
      label: b.type === "custom" || b.type === "collection" ? b.title || "More" : BLOCK_LABELS[b.type as BlockType],
    }));
  const openFounder = founders.find((f) => f.id === founderId) ?? null;

  const heading = welcome?.title || (welcome?.lead_name ? `Welcome, ${welcome.lead_name}` : "Welcome");
  const sub = welcome?.subtitle || "A closer look at Founders First Network, put together for you.";
  const meta = [welcome?.startup_name, welcome?.founder_stage].filter(Boolean).join(" · ");

  return (
    <div className={`ffn-hub${preview ? " is-preview" : ""}`}>
      <style>{HUB_CSS}</style>

      {preview && <div className="hub-preview">Preview, not tracked</div>}

      {data.show_navbar !== false && (
        <header inert={openFounder ? true : undefined} className={`hub-nav${scrolled ? " is-scrolled" : ""}`}>
          <div className="hub-wrap hub-nav-inner">
            <a className="hub-brand" href="#top" aria-label="Founders First Network, top of page">
              <BrandLockup width="calc(var(--space-16) * 2.25)" />
            </a>

            <nav className="hub-nav-links" aria-label="Sections">
              {navSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined}>
                  {section.label}
                </a>
              ))}
            </nav>

            <div className="hub-nav-end">
              <button
                type="button"
                className="hub-menu-btn"
                aria-expanded={menuOpen}
                aria-controls="hub-menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                Sections <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
              {bookingUrl && (
                <a
                  className="hub-btn hub-btn--primary hub-btn--sm hub-nav-cta"
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_click", "cta", "booking")}
                >
                  {cta?.cta_text || "Book time"}
                </a>
              )}
            </div>
          </div>
          {menuOpen && (
            <div id="hub-menu" className="hub-menu">
              <div className="hub-wrap">
                {menuSections.map((section) => (
                  <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined} onClick={() => setMenuOpen(false)}>
                    {section.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </header>
      )}

      <main id="top" inert={openFounder ? true : undefined}>
        <div className="hub-hero" id={welcome ? "welcome" : undefined}>
          <span className="hub-shear" aria-hidden="true" />
          <div className="hub-wrap hub-hero-inner">
            <p className="hub-eyebrow hub-eyebrow--inverse">Prepared for you</p>
            <h1 className="hub-title">{heading}</h1>
            <p className="hub-hero-sub">{sub}</p>
            {meta && <p className="hub-hero-meta">{meta}</p>}
            {welcome?.current_context && (
              <div className="hub-hero-note">
                <p className="hub-hero-note-label">What you told us</p>
                <p>{welcome.current_context}</p>
              </div>
            )}
          </div>
        </div>

        {data.blocks.map((block) => {
          switch (block.type) {
            case "about":
              return (
                <AboutBlock
                  key="about"
                  data={{
                    one_liner: block.one_liner ?? null,
                    helps_founders_do: block.helps_founders_do ?? null,
                    approach: block.approach ?? null,
                    differentiator: block.differentiator ?? null,
                    website_url: block.website_url ?? null,
                  }}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "who_for":
              return (
                <WhoForBlock
                  key="who_for"
                  data={{
                    founder_stages_supported: block.founder_stages_supported ?? [],
                    startup_stages_supported: block.startup_stages_supported ?? [],
                    founder_types: block.founder_types ?? [],
                    industries: block.industries ?? [],
                  }}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "helps_with":
              return (
                <HelpsWithBlock
                  key="helps_with"
                  data={{ problems_addressed: block.problems_addressed ?? [] }}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "how_supports":
              return (
                <HowSupportsBlock
                  key="how_supports"
                  data={{ support_formats: block.support_formats ?? [] }}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "programs":
              return (
                <ProgramsBlock
                  key="programs"
                  items={block.programs ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onView={(id) => track("view", "programs", id)}
                />
              );
            case "founders":
              return (
                <FoundersBlock
                  key="founders"
                  items={block.founders ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onOpen={(f) => setFounderId(f.id)}
                  onLink={(label) => track("cta_click", "links", label)}
                />
              );
            case "case_studies":
              return (
                <CaseStudiesBlock
                  key="case_studies"
                  items={block.case_studies ?? []}
                  openId={caseId}
                  onOpen={openCaseStudy}
                  onClose={closeCaseStudy}
                  track={track}
                  flush={flush}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "testimonials":
              return (
                <TestimonialsBlock
                  key="testimonials"
                  items={block.testimonials ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  founders={founders}
                  onView={(id) => track("view", "testimonials", id)}
                  onVideo={(id) => track("cta_click", "testimonials", id)}
                />
              );
            case "mentors":
              return (
                <MentorsBlock
                  key="mentors"
                  items={block.mentors ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onView={(id) => track("view", "mentors", id)}
                  onLink={(label) => track("cta_click", "links", label)}
                />
              );
            case "credibility":
              return (
                <CredibilityBlock
                  key="credibility"
                  data={{
                    founders_stat: block.founders_stat ?? null,
                    programs_stat: block.programs_stat ?? null,
                    events_stat: block.events_stat ?? null,
                    partnerships_stat: block.partnerships_stat ?? null,
                  }}
                  title={block.title}
                  subtitle={block.subtitle}
                />
              );
            case "links":
              return (
                <LinksBlock
                  key="links"
                  items={block.links ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onLinkClick={(label) => track("cta_click", "links", label)}
                />
              );
            case "faqs":
              return (
                <FaqsBlock
                  key="faqs"
                  items={block.faqs ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onView={(id) => track("view", "faqs", id)}
                />
              );
            case "cta":
              return (
                <CtaBlock
                  key="cta"
                  data={{
                    cta_text: block.cta_text ?? null,
                    booking_url: block.booking_url ?? null,
                  }}
                  title={block.title}
                  subtitle={block.subtitle}
                  onCtaClick={() => track("cta_click", "cta", "booking")}
                />
              );
            case "custom":
              return (
                <CustomBlock
                  key={sectionIdOf(block)}
                  id={sectionIdOf(block)}
                  body={block.body ?? null}
                  imageUrl={block.image_url ?? null}
                  buttonLabel={block.button_label ?? null}
                  buttonUrl={block.button_url ?? null}
                  title={block.title}
                  subtitle={block.subtitle}
                  onButtonClick={(label) => track("cta_click", "links", label)}
                />
              );
            case "collection":
              return (
                <CollectionBlock
                  key={sectionIdOf(block)}
                  id={sectionIdOf(block)}
                  items={block.items ?? []}
                  title={block.title}
                  subtitle={block.subtitle}
                  onView={(id) => track("view", "collection", id)}
                  onLink={(label) => track("cta_click", "links", label)}
                />
              );
            default:
              return null;
          }
        })}
      </main>

      <footer className="hub-footer" inert={openFounder ? true : undefined}>
        <div className="hub-wrap hub-footer-inner">
          <span className="hub-footer-brand">
            <Image src="/logos/ffn-mark-on-black.png" alt="" width={24} height={24} />
            <span>Founders First Network</span>
          </span>
          <span className="hub-footer-note">Prepared for you. Please keep this link to yourself.</span>
        </div>
      </footer>

      {openFounder && (
        <FounderDrawer
          founder={openFounder}
          caseStudies={caseStudies.filter((c) => c.founders.some((f) => f.id === openFounder.id))}
          quotes={testimonials.filter((t) => t.founder?.id === openFounder.id && t.testimonial_quote)}
          track={track}
          onClose={closeFounder}
          onOpenCaseStudy={(item) => {
            setFounderId(null);
            openCaseStudy(item);
          }}
        />
      )}
    </div>
  );
}
