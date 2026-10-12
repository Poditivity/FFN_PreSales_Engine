import { listCaseStudies } from "@/lib/content/caseStudies";
import { listFaqs } from "@/lib/content/faqs";
import { listFounders } from "@/lib/content/founders";
import { listMentors } from "@/lib/content/mentors";
import { listPrograms } from "@/lib/content/programs";
import { listTestimonials } from "@/lib/content/testimonials";
import type { ItemOption } from "@/components/hubs/ModuleComposer";
import type { BlockType } from "./types";

/**
 * Loads the option lists the hand-picked-mode picker in ModuleComposer
 * needs, one per content-list block type. Singleton blocks (welcome, about,
 * who_for, helps_with, how_supports, credibility, cta) and
 * the "links" block have no item list — they're always [] here, since their
 * ModuleComposer UI never renders a picker for them.
 */
export async function loadItemsByType(): Promise<Record<BlockType, ItemOption[]>> {
  const [founders, caseStudies, testimonials, mentors, programs, faqs] = await Promise.all([
    listFounders(),
    listCaseStudies(),
    listTestimonials(),
    listMentors(),
    listPrograms(),
    listFaqs(),
  ]);
  return {
    welcome: [],
    about: [],
    who_for: [],
    helps_with: [],
    how_supports: [],
    programs: programs.map((p) => ({ id: p.id, label: p.name })),
    founders: founders.map((f) => ({ id: f.id, label: f.startup_name ? `${f.name} (${f.startup_name})` : f.name })),
    case_studies: caseStudies.map((c) => ({ id: c.id, label: c.title })),
    testimonials: testimonials.map((t) => ({
      id: t.id,
      label: t.founders?.name ?? t.testimonial_quote?.slice(0, 40) ?? "Testimonial",
    })),
    mentors: mentors.map((m) => ({ id: m.id, label: m.name })),
    credibility: [],
    links: [],
    faqs: faqs.map((f) => ({ id: f.id, label: f.question })),
    cta: [],
  };
}
