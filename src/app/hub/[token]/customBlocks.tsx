"use client";

import { ArrowUpRight } from "lucide-react";
import { sanitizeEmailHtml } from "@/lib/messaging/text";
import type { HubCollectionItem } from "@/lib/hubs/publicHub";
import { Section, SectionHead, useSeen, type BlockHeading } from "./ui";

// The two sections staff add to a hub template themselves. They live apart from
// blocks.tsx, which pulls in the PDF reader, so the template editor can preview
// them exactly as an applicant sees them without loading all of that.

/** Adds a scheme to a bare domain typed into the content database, so the link does not resolve against this site. */
export function externalUrl(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// ---------------------------------------------------------------------------
// Sections staff add to a template: their own text, or a collection
// ---------------------------------------------------------------------------

/**
 * A section written in the template: rich text, an image and a button. The text
 * was cleaned by hub-hydrate and is cleaned again here, so nothing but the editor's
 * small set of tags can reach the page.
 */
export function CustomBlock({
  id,
  body,
  imageUrl,
  buttonLabel,
  buttonUrl,
  title,
  subtitle,
  onButtonClick,
}: {
  id: string;
  body: string | null;
  imageUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  onButtonClick: (label: string) => void;
} & BlockHeading) {
  if (!body && !imageUrl) return null;
  return (
    <Section id={id}>
      <SectionHead eyebrow="From us" title={title || "More from us"} subtitle={subtitle} />
      <div className={`cu-wrap${imageUrl && body ? " cu-wrap--image" : ""}`}>
        {(body || (buttonLabel && buttonUrl)) && (
          <div>
            {body && <div className="cu-body" dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(body) }} />}
            {buttonLabel && buttonUrl && (
              <p className="cu-actions">
                <a className="hub-btn hub-btn--primary hub-btn--lg" href={buttonUrl} target="_blank" rel="noreferrer" onClick={() => onButtonClick(buttonLabel)}>
                  {buttonLabel} <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </a>
              </p>
            )}
          </div>
        )}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded or external URL, not a static app asset
          <img className="cu-image" src={imageUrl} alt="" loading="lazy" />
        )}
      </div>
    </Section>
  );
}

function CollectionCard({ item, onView, onLink }: { item: HubCollectionItem; onView: (id: string) => void; onLink: (label: string) => void }) {
  const seen = useSeen<HTMLElement>(() => onView(item.id));
  const link = externalUrl(item.link_url);
  return (
    <article ref={seen} className="cl-card">
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded or external URL, not a static app asset
        <img className="cl-media" src={item.image_url} alt="" loading="lazy" />
      )}
      <div className="cl-main">
        <p className="cl-name">{item.title}</p>
        {item.description && <p className="cl-text">{item.description}</p>}
        {link && (
          <a className="hub-more" href={link} target="_blank" rel="noreferrer" onClick={() => onLink(item.title)}>
            Open <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

/** A list of the items in one of the content database's collections. */
export function CollectionBlock({
  id,
  items,
  title,
  subtitle,
  onView,
  onLink,
}: {
  id: string;
  items: HubCollectionItem[];
  onView: (id: string) => void;
  onLink: (label: string) => void;
} & BlockHeading) {
  if (items.length === 0) return null;
  return (
    <Section id={id}>
      <SectionHead eyebrow="Also for you" title={title || "More for you"} subtitle={subtitle} />
      <div className="hub-grid hub-grid--3">
        {items.map((item) => (
          <CollectionCard key={item.id} item={item} onView={onView} onLink={onLink} />
        ))}
      </div>
    </Section>
  );
}
