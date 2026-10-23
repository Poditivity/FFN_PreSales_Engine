"use client";

import { ArrowRight, ArrowUpRight, Check, FileText, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { caseStudySource } from "@/lib/content/casePdf";
import type {
  HubAboutPayload,
  HubCaseStudyItem,
  HubCredibilityPayload,
  HubCtaPayload,
  HubFaqItem,
  HubFounderItem,
  HubHelpsWithPayload,
  HubHowSupportsPayload,
  HubMentorItem,
  HubModuleLinkItem,
  HubProgramItem,
  HubTestimonialItem,
  HubWhoForPayload,
} from "@/lib/hubs/publicHub";
import { CaseStudyReader, type TrackFn } from "./CaseStudyReader";
import { drawPage, loadPdf } from "./pdf";
import { externalUrl } from "./customBlocks";
import { Portrait, Section, SectionHead, useSeen, type BlockHeading } from "./ui";

// ---------------------------------------------------------------------------
// Founders
// ---------------------------------------------------------------------------

export function FoundersBlock({
  items,
  onOpen,
  onLink,
  title,
  subtitle,
}: {
  items: HubFounderItem[];
  onOpen: (founder: HubFounderItem) => void;
  onLink: (label: string) => void;
} & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id="founders">
      <SectionHead title={title || "Founders"} subtitle={subtitle || "Open a profile to read the whole story."} />
      <div className="hub-grid hub-grid--3">
        {items.map((f) => {
          const line = f.outcome || f.starting_problem || f.journey;
          const website = externalUrl(f.website_url);
          return (
            <article key={f.id} className="fd-card">
              <div className="fd-top">
                <Portrait name={f.name} src={f.photo_url} size="lg" />
                <div className="fd-id">
                  <p className="fd-name">{f.name}</p>
                  {f.industry && <p className="fd-startup">{f.industry}</p>}
                </div>
              </div>

              {(f.startup_name || f.startup_logo_url) && (
                <div className="fd-company">
                  {f.startup_logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URL
                    <img src={f.startup_logo_url} alt="" className="fd-logo" loading="lazy" />
                  )}
                  {f.startup_name && <p className="fd-company-name">{f.startup_name}</p>}
                </div>
              )}

              {line && <p className="fd-line">{line}</p>}

              <div className="fd-foot">
                <button
                  type="button"
                  className="hub-btn hub-btn--primary hub-btn--sm"
                  onClick={() => onOpen(f)}
                  aria-label={`View the complete profile of ${f.name}`}
                >
                  View complete profile
                </button>
                {website && (
                  <a className="hub-text-btn" href={website} target="_blank" rel="noreferrer" onClick={() => onLink(`${f.startup_name || f.name} website`)}>
                    Website <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Case studies
// ---------------------------------------------------------------------------

/** The first page of the PDF, cropped to a cover. A file that cannot be read gets a plain cover instead. */
function PdfCover({ url, onPages }: { url: string | null; onPages: (n: number) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readable = caseStudySource(url) === "pdf";
  const [state, setState] = useState<"idle" | "ready" | "plain">(readable ? "idle" : "plain");

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!readable || !url || !box || !canvas) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadPdf(url)
          .then(async (doc) => {
            await drawPage(doc, 1, canvas, box.clientWidth);
            if (cancelled) return;
            onPages(doc.numPages);
            setState("ready");
          })
          .catch(() => {
            if (!cancelled) setState("plain");
          });
      },
      { rootMargin: "300px" },
    );
    observer.observe(box);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [readable, url, onPages]);

  return (
    <div ref={boxRef} className={`cs-cover cs-cover--${state}`}>
      {state !== "plain" && <canvas ref={canvasRef} aria-hidden="true" />}
      {state !== "ready" && (
        <span className="cs-plain" aria-hidden="true">
          <FileText size={28} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

function CaseCard({ item, active, onOpen }: { item: HubCaseStudyItem; active: boolean; onOpen: () => void }) {
  const [pages, setPages] = useState<number | null>(null);
  const names = item.founders.map((f) => f.name).join(", ");
  return (
    <button type="button" className="cs-card" aria-current={active ? "true" : undefined} onClick={onOpen}>
      <PdfCover url={item.case_study_link} onPages={setPages} />
      <div className="cs-meta">
        <p className="cs-title">{item.title}</p>
        {names && <p className="cs-founders">{names}</p>}
        <span className="hub-more">
          {active ? "Reading now" : "Read case study"} <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
          {pages ? <span className="cs-pages data-sm">{pages} pages</span> : null}
        </span>
      </div>
    </button>
  );
}

export function CaseStudiesBlock({
  items,
  openId,
  onOpen,
  onClose,
  track,
  flush,
  title,
  subtitle,
}: {
  items: HubCaseStudyItem[];
  openId: string | null;
  onOpen: (item: HubCaseStudyItem) => void;
  onClose: () => void;
  track: TrackFn;
  flush: () => void;
} & BlockHeading) {
  if (items.length === 0) return null;
  const open = items.find((c) => c.id === openId) ?? null;
  return (
    <Section id="case_studies">
      <SectionHead title={title || "Case studies"} subtitle={subtitle || "Read each one here, without leaving the page."} />
      {open && <CaseStudyReader key={open.id} item={open} track={track} flush={flush} onClose={onClose} />}
      <div className="hub-grid hub-grid--3">
        {items.map((cs) => (
          <CaseCard key={cs.id} item={cs} active={cs.id === openId} onOpen={() => onOpen(cs)} />
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Testimonials, mentors, FAQs
// ---------------------------------------------------------------------------

/**
 * "Founder, Startup" under a testimonial, or "Co-Founder, Startup" when the
 * founder is not building alone. The startup and the co-founder flag come from
 * hub-hydrate; an older deployment does not send them, so the founders block on
 * the same page stands in.
 */
export function founderCredit(
  person: NonNullable<HubTestimonialItem["founder"]>,
  founders: HubFounderItem[],
): string {
  const known = founders.find((f) => f.id === person.id);
  const startup = (person.startup_name ?? known?.startup_name ?? "").trim();
  const sameStartup = startup
    ? founders.filter((f) => (f.startup_name ?? "").trim().toLowerCase() === startup.toLowerCase()).length
    : 0;
  const co = person.is_co_founder ?? ((known?.co_founders.length ?? 0) > 0 || sameStartup > 1);
  const role = co ? "Co-Founder" : "Founder";
  return startup ? `${role}, ${startup}` : role;
}

function QuoteCard({
  item,
  founders,
  onView,
  onVideo,
}: {
  item: HubTestimonialItem;
  founders: HubFounderItem[];
  onView: (id: string) => void;
  onVideo: (id: string) => void;
}) {
  const ref = useSeen<HTMLElement>(() => onView(item.id));
  const founder = item.founder;
  const logo = founder ? (founder.startup_logo_url ?? founders.find((f) => f.id === founder.id)?.startup_logo_url ?? null) : null;
  return (
    <figure ref={ref} className="tm-card">
      {item.testimonial_quote && <blockquote className="tm-quote">{item.testimonial_quote}</blockquote>}
      <figcaption className="tm-by">
        {founder && <Portrait name={founder.name} src={founder.photo_url ?? founders.find((f) => f.id === founder.id)?.photo_url} size="md" />}
        <div>
          {founder && <p className="tm-name">{founder.name}</p>}
          {founder && (
            <p className="tm-role">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URL
                <img src={logo} alt="" className="tm-logo" loading="lazy" />
              )}
              <span>{founderCredit(founder, founders)}</span>
            </p>
          )}
          {item.video_link && (
            <div className="tm-actions">
              <a className="hub-text-btn" href={item.video_link} target="_blank" rel="noreferrer" onClick={() => onVideo(item.id)}>
                <Play size={13} strokeWidth={1.75} aria-hidden="true" /> Watch the video
              </a>
            </div>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export function TestimonialsBlock({
  items,
  founders,
  onView,
  onVideo,
  title,
  subtitle,
}: {
  items: HubTestimonialItem[];
  founders: HubFounderItem[];
  onView: (id: string) => void;
  onVideo: (id: string) => void;
} & BlockHeading) {
  const shown = items.filter((t) => t.testimonial_quote || t.video_link);
  if (shown.length === 0) return null;
  return (
    <Section id="testimonials">
      <SectionHead title={title || "Testimonials"} subtitle={subtitle} />
      <div className="hub-grid hub-grid--2">
        {shown.map((t) => (
          <QuoteCard key={t.id} item={t} founders={founders} onView={onView} onVideo={onVideo} />
        ))}
      </div>
    </Section>
  );
}

function MentorCard({ item, onView, onLink }: { item: HubMentorItem; onView: (id: string) => void; onLink: (label: string) => void }) {
  const ref = useSeen<HTMLDivElement>(() => onView(item.id));
  const linkedin = externalUrl(item.linkedin_url);
  return (
    <div ref={ref} className="mn-card">
      <div className="mn-head">
        <Portrait name={item.name} src={item.photo_url} size="lg" />
        <div className="mn-id">
          <p className="mn-name">{item.name}</p>
          {item.role && <p className="mn-role">{item.role}</p>}
        </div>
      </div>
      {item.expertise && (
        <div className="mn-part">
          <p className="mn-label">Expertise</p>
          <p className="mn-text">{item.expertise}</p>
        </div>
      )}
      {item.relevant_experience && (
        <div className="mn-part">
          <p className="mn-label">Relevant experience</p>
          <p className="mn-text">{item.relevant_experience}</p>
        </div>
      )}
      {linkedin && (
        <a className="hub-text-btn mn-link" href={linkedin} target="_blank" rel="noreferrer" onClick={() => onLink(`${item.name} LinkedIn`)}>
          LinkedIn <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export function MentorsBlock({
  items,
  onView,
  onLink,
  title,
  subtitle,
}: { items: HubMentorItem[]; onView: (id: string) => void; onLink: (label: string) => void } & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id="mentors">
      <SectionHead title={title || "Mentors"} subtitle={subtitle} />
      <div className="hub-grid hub-grid--3">
        {items.map((m) => (
          <MentorCard key={m.id} item={m} onView={onView} onLink={onLink} />
        ))}
      </div>
    </Section>
  );
}

export function FaqsBlock({
  items,
  onView,
  title,
  subtitle,
}: { items: HubFaqItem[]; onView: (id: string) => void } & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id="faqs">
      <SectionHead title={title || "FAQs"} subtitle={subtitle} />
      <div className="faq">
        {items.map((f) => (
          <details key={f.id} className="faq-item" onToggle={(e) => e.currentTarget.open && onView(f.id)}>
            <summary>
              <span>{f.question}</span>
              <Plus size={18} strokeWidth={1.75} className="faq-icon" aria-hidden="true" />
            </summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// About FFN
// ---------------------------------------------------------------------------

function TagRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="wf-row">
      <p className="wf-label">{label}</p>
      <ul className="hub-tags">
        {values.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </div>
  );
}

export function AboutBlock({ data, title, subtitle }: { data: HubAboutPayload } & BlockHeading) {
  const parts = [
    { label: "What we help founders do", value: data.helps_founders_do },
    { label: "Our approach", value: data.approach },
    { label: "What makes us different", value: data.differentiator },
  ].filter((i): i is { label: string; value: string } => Boolean(i.value));
  return (
    <Section id="about">
      <SectionHead title={title || "About Founders First Network"} subtitle={subtitle || data.one_liner} />
      {parts.length > 0 && (
        <div className="ab-cols">
          {parts.map((part, i) => (
            <div key={part.label} className="ab-col">
              <span className="ab-num data-sm" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="ab-label">{part.label}</h3>
              <p className="ab-text">{part.value}</p>
            </div>
          ))}
        </div>
      )}
      {data.website_url && (
        <a className="hub-link" href={data.website_url} target="_blank" rel="noreferrer">
          Visit our website <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}
    </Section>
  );
}

export function WhoForBlock({ data, title, subtitle }: { data: HubWhoForPayload } & BlockHeading) {
  const any =
    data.founder_stages_supported.length +
      data.startup_stages_supported.length +
      data.founder_types.length +
      data.industries.length >
    0;
  if (!any) return null;
  return (
    <Section id="who_for">
      <SectionHead title={title || "Who FFN is for"} subtitle={subtitle} />
      <div className="wf">
        <TagRow label="Founder stages" values={data.founder_stages_supported} />
        <TagRow label="Startup stages" values={data.startup_stages_supported} />
        <TagRow label="Founder types" values={data.founder_types} />
        <TagRow label="Industries" values={data.industries} />
      </div>
    </Section>
  );
}

export function HelpsWithBlock({ data, title, subtitle }: { data: HubHelpsWithPayload } & BlockHeading) {
  if (data.problems_addressed.length === 0) return null;
  return (
    <Section id="helps_with">
      <SectionHead title={title || "What FFN helps with"} subtitle={subtitle} />
      <ul className="hw-list">
        {data.problems_addressed.map((p) => (
          <li key={p}>
            <span className="hw-tick" aria-hidden="true">
              <Check size={14} strokeWidth={2} />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HowSupportsBlock({ data, title, subtitle }: { data: HubHowSupportsPayload } & BlockHeading) {
  if (data.support_formats.length === 0) return null;
  return (
    <Section id="how_supports">
      <SectionHead title={title || "How FFN supports founders"} subtitle={subtitle} />
      <ol className="hs-grid">
        {data.support_formats.map((f, i) => (
          <li key={f} className="hs-item">
            <span className="hs-num data-sm" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="hs-text">{f}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ProgramCard({ item, onView }: { item: HubProgramItem; onView: (id: string) => void }) {
  const ref = useSeen<HTMLElement>(() => onView(item.id));
  return (
    <article ref={ref} className="pg-card">
      <h3 className="pg-name">{item.name}</h3>
      {item.description && <p className="pg-text">{item.description}</p>}
      {item.stages.length > 0 && (
        <ul className="hub-tags hub-tags--tight">
          {item.stages.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProgramsBlock({
  items,
  onView,
  title,
  subtitle,
}: { items: HubProgramItem[]; onView: (id: string) => void } & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id="programs">
      <SectionHead title={title || "Programs"} subtitle={subtitle} />
      <div className="hub-grid hub-grid--2">
        {items.map((p) => (
          <ProgramCard key={p.id} item={p} onView={onView} />
        ))}
      </div>
    </Section>
  );
}

export function CredibilityBlock({ data, title, subtitle }: { data: HubCredibilityPayload } & BlockHeading) {
  const stats = [
    { label: "Founders supported", value: data.founders_stat },
    { label: "Programs delivered", value: data.programs_stat },
    { label: "Events", value: data.events_stat },
    { label: "Partnerships", value: data.partnerships_stat },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));
  if (stats.length === 0) return null;
  return (
    <Section id="credibility">
      <SectionHead title={title || "FFN credibility"} subtitle={subtitle} />
      <dl className="cr-strip">
        {stats.map((s) => (
          <div key={s.label} className="cr-stat">
            <dt className="cr-label">{s.label}</dt>
            <dd className="cr-value">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function LinksBlock({
  items,
  title,
  subtitle,
  onLinkClick,
}: { items: HubModuleLinkItem[]; onLinkClick: (label: string) => void } & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id="links">
      <SectionHead title={title || "Relevant links"} subtitle={subtitle} />
      <div className="ln-list">
        {items.map((link) => (
          <a key={link.url} className="ln-row" href={link.url} target="_blank" rel="noreferrer" onClick={() => onLinkClick(link.label)}>
            <span>{link.label}</span>
            <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </a>
        ))}
      </div>
    </Section>
  );
}

// The closing band. It is the one dark section after the hero, so the next step
// is the last thing on the page and is easy to find.
export function CtaBlock({
  data,
  title,
  subtitle,
  onCtaClick,
}: { data: HubCtaPayload; onCtaClick: () => void } & BlockHeading) {
  return (
    <section id="cta" className="hub-cta">
      <div className="hub-wrap hub-cta-inner">
        <div>
          <p className="hub-eyebrow hub-eyebrow--inverse">Next step</p>
          <h2 className="hub-h2 hub-h2--inverse">{title || "Talk with us"}</h2>
          {subtitle && <p className="hub-lede hub-lede--inverse">{subtitle}</p>}
        </div>
        <div className="cta-side">
          {data.booking_url && (
            <a className="hub-btn hub-btn--primary hub-btn--lg" href={data.booking_url} target="_blank" rel="noreferrer" onClick={onCtaClick}>
              {data.cta_text || "Book time with us"} <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
