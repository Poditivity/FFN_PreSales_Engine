import { z } from "zod";

// Cross-cutting conventions shared by every content type (see the Phase 3
// migration header): visibility, audience as an array of track ids (empty =
// everyone), featured, sort_order. Visibility is two-state: a draft never
// appears on a hub, a public item can. There used to be a third, "hidden",
// which behaved exactly like draft, so it was removed
// (20260929130000_visibility_draft_or_public.sql).
export const visibilitySchema = z.enum(["draft", "public"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "public", label: "Public" },
];

export const trackSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Track = z.infer<typeof trackSchema>;

export const founderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  photo_url: z.string().nullable(),
  startup_name: z.string().nullable(),
  startup_logo_url: z.string().nullable(),
  website_url: z.string().nullable(),
  starting_stage: z.string().nullable(),
  current_stage: z.string().nullable(),
  starting_problem: z.string().nullable(),
  journey: z.string().nullable(),
  industry: z.string().nullable(),
  ffn_support: z.string().nullable(),
  key_change: z.string().nullable(),
  outcome: z.string().nullable(),
  milestones: z.string().nullable(),
  professional_experience: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Founder = z.infer<typeof founderSchema>;

export interface CaseStudyFounderLink {
  founder_id: string;
  sort_order: number;
  founders: { id: string; name: string };
}

export const caseStudySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  case_study_link: z.string().nullable(),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseStudy = z.infer<typeof caseStudySchema> & {
  case_study_founders?: CaseStudyFounderLink[];
};

export const testimonialSchema = z.object({
  id: z.string().uuid(),
  founder_id: z.string().uuid(),
  testimonial_quote: z.string().nullable(),
  video_link: z.string().nullable(),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Testimonial = z.infer<typeof testimonialSchema> & {
  founders?: { id: string; name: string } | null;
};

export const mentorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  photo_url: z.string().nullable(),
  role: z.string().nullable(),
  expertise: z.string().nullable(),
  relevant_experience: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Mentor = z.infer<typeof mentorSchema>;

export const faqSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1),
  answer: z.string().min(1),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Faq = z.infer<typeof faqSchema>;

export const programSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  stages: z.array(z.string()),
  problems_addressed: z.array(z.string()),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Program = z.infer<typeof programSchema>;

// A collection is a content type staff define themselves (Events, Partners...).
// Its items carry the same cross-cutting fields as every other content type.
export const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;

export const collectionItemSchema = z.object({
  id: z.string().uuid(),
  collection_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  link_url: z.string().nullable(),
  audience: z.array(z.string()),
  featured: z.boolean(),
  visibility: visibilitySchema,
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CollectionItem = z.infer<typeof collectionItemSchema>;
