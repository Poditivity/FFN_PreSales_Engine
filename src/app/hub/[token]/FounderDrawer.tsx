"use client";

import { ArrowRight, ArrowUpRight, ExternalLink, FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { HubCaseStudyItem, HubFounderItem, HubTestimonialItem } from "@/lib/hubs/publicHub";
import type { TrackFn } from "./CaseStudyReader";
import { Portrait, splitLines } from "./ui";

// The parts of a founder's story, in the order a reader would want them. A part
// with nothing written is skipped, so a founder with a short record still reads
// as complete.
const STORY: { key: keyof HubFounderItem; label: string }[] = [
  { key: "starting_problem", label: "Starting problem" },
  { key: "journey", label: "Journey" },
  { key: "ffn_support", label: "FFN support" },
  { key: "key_change", label: "Key change" },
];

export function FounderDrawer({
  founder,
  caseStudies,
  quotes,
  track,
  onClose,
  onOpenCaseStudy,
}: {
  founder: HubFounderItem;
  caseStudies: HubCaseStudyItem[];
  quotes: HubTestimonialItem[];
  track: TrackFn;
  onClose: () => void;
  onOpenCaseStudy: (item: HubCaseStudyItem) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opening a founder is the view. How long it stayed open is logged on close.
  useEffect(() => {
    const opened = Date.now();
    track("view", "founders", founder.id);
    return () => {
      const seconds = Math.round((Date.now() - opened) / 1000);
      if (seconds >= 2) track("item_time", "founders", founder.id, { seconds });
    };
  }, [track, founder.id]);

  // Focus goes into the drawer, stays inside it, and returns to the card that opened it.
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      origin?.focus?.();
    };
  }, [onClose]);

  const milestones = splitLines(founder.milestones);
  const story = STORY.filter((part) => founder[part.key]);
  const hasStages = Boolean(founder.starting_stage || founder.current_stage);

  return (
    <div className="dr-root">
      <div className="dr-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} className="dr" role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <header className="dr-top">
          <p className="hub-eyebrow">Founder profile</p>
          <button ref={closeRef} type="button" className="rd-btn" aria-label="Close founder profile" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        <div className="dr-scroll">
          <div className="dr-id">
            <Portrait name={founder.name} src={founder.photo_url} size="xl" />
            <div>
              <h2 id="dr-title" className="dr-name">
                {founder.name}
              </h2>
              {(founder.startup_name || founder.industry) && (
                <p className="dr-startup">
                  {founder.startup_logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external content-database URL
                    <img src={founder.startup_logo_url} alt="" className="dr-logo" />
                  )}
                  <span>{[founder.startup_name, founder.industry].filter(Boolean).join(" · ")}</span>
                </p>
              )}
              {(founder.website_url || founder.linkedin_url) && (
                <p className="dr-links">
                  {founder.website_url && (
                    <a href={founder.website_url} target="_blank" rel="noreferrer" onClick={() => track("cta_click", "links", `${founder.name} website`)}>
                      Website <ArrowUpRight size={14} strokeWidth={1.75} />
                    </a>
                  )}
                  {founder.linkedin_url && (
                    <a href={founder.linkedin_url} target="_blank" rel="noreferrer" onClick={() => track("cta_click", "links", `${founder.name} LinkedIn`)}>
                      LinkedIn <ExternalLink size={13} strokeWidth={1.75} />
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>

          {hasStages && (
            <div className="dr-stages" aria-label="Stage then and now">
              <div>
                <p className="dr-stage-label">Starting stage</p>
                <p className="dr-stage-value">{founder.starting_stage || "Not shared"}</p>
              </div>
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="dr-stage-arrow" />
              <div>
                <p className="dr-stage-label">Current stage</p>
                <p className="dr-stage-value">{founder.current_stage || "Not shared"}</p>
              </div>
            </div>
          )}

          {story.map((part) => (
            <div key={part.key} className="dr-part">
              <h3 className="dr-part-label">{part.label}</h3>
              <p className="dr-part-text">{founder[part.key] as string}</p>
            </div>
          ))}

          {founder.outcome && (
            <div className="dr-outcome">
              <p className="hub-eyebrow">Outcome</p>
              <p className="dr-outcome-text">{founder.outcome}</p>
            </div>
          )}

          {milestones.length > 0 && (
            <div className="dr-part">
              <h3 className="dr-part-label">Milestones</h3>
              <ul className="dr-list">
                {milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {founder.professional_experience && (
            <div className="dr-part">
              <h3 className="dr-part-label">Background</h3>
              <p className="dr-part-text">{founder.professional_experience}</p>
            </div>
          )}

          {founder.co_founders.length > 0 && (
            <div className="dr-part">
              <h3 className="dr-part-label">Building with</h3>
              <p className="dr-part-text">{founder.co_founders.map((c) => c.name).join(", ")}</p>
            </div>
          )}

          {quotes.map((q) => (
            <figure key={q.id} className="dr-quote">
              <blockquote>{q.testimonial_quote}</blockquote>
              <figcaption>{founder.name}</figcaption>
            </figure>
          ))}

          {caseStudies.length > 0 && (
            <div className="dr-part">
              <h3 className="dr-part-label">Read the case study</h3>
              <div className="dr-docs">
                {caseStudies.map((cs) => (
                  <button key={cs.id} type="button" className="dr-doc" onClick={() => onOpenCaseStudy(cs)}>
                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>{cs.title}</span>
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
