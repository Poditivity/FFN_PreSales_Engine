// What each Content Database record needs before it can be saved. The rule of
// thumb: a record is required to carry whatever the public hub actually shows
// for it. A case study without a link, a testimonial with no quote and no
// video, or a founder with no startup or story would render as an empty card,
// so none of those can be saved. Everything else stays optional.
//
// Each validator returns errors keyed by field, so an editor can mark the
// exact field. An empty object means the record is fine to save.

import { caseStudySource } from "./casePdf";

export type FieldErrors = Record<string, string>;

const blank = (value: string | null | undefined) => !value || !value.trim();

/** True for a full http or https link, which is what the hub renders as an href. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const BAD_LINK = "Enter a full link that starts with https://";

/** Adds an error when a link that was filled in is not a usable link. Empty is fine here. */
function optionalLink(errors: FieldErrors, key: string, value: string | null | undefined) {
  if (!blank(value) && !isHttpUrl(value!)) errors[key] = BAD_LINK;
}

export function validateTrack(input: { name: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.name)) errors.name = "Add a name.";
  // The slug is generated from the name, so a name with no letters or digits would produce none.
  else if (!/[a-z0-9]/i.test(input.name)) errors.name = "Use a name with at least one letter or number.";
  return errors;
}

export function validateFounder(input: {
  name: string;
  startup_name: string | null;
  photo_url: string | null;
  startup_logo_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.name)) errors.name = "Add the founder's name.";
  if (blank(input.startup_name)) errors.startup_name = "Add the startup name.";
  optionalLink(errors, "photo_url", input.photo_url);
  optionalLink(errors, "startup_logo_url", input.startup_logo_url);
  optionalLink(errors, "website_url", input.website_url);
  optionalLink(errors, "linkedin_url", input.linkedin_url);
  return errors;
}

export function validateCaseStudy(input: { title: string; case_study_link: string | null }, founderIds: string[]): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.title)) errors.title = "Add a title.";
  // A case study is a PDF the hub reads in the page. Uploading one is the way to
  // get page by page tracking; a link to a PDF or a Google Drive file also works.
  if (blank(input.case_study_link)) {
    errors.case_study_link = "Add the case study PDF. Upload a file, or paste a link to a PDF.";
  } else if (!isHttpUrl(input.case_study_link!)) {
    errors.case_study_link = BAD_LINK;
  } else if (caseStudySource(input.case_study_link) === "other") {
    errors.case_study_link = "Use a PDF. Upload a file, or paste a link to a PDF or a Google Drive file.";
  }
  if (founderIds.filter(Boolean).length === 0) errors.founders = "Link at least one founder.";
  return errors;
}

export function validateTestimonial(input: {
  founder_id: string;
  testimonial_quote: string | null;
  video_link: string | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.founder_id)) errors.founder_id = "Choose the founder.";
  if (blank(input.testimonial_quote) && blank(input.video_link)) {
    errors.testimonial_quote = "Add a quote, a video link, or both.";
  }
  optionalLink(errors, "video_link", input.video_link);
  return errors;
}

export function validateMentor(input: {
  name: string;
  role: string | null;
  expertise: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.name)) errors.name = "Add the mentor's name.";
  if (blank(input.role)) errors.role = "Add their role.";
  if (blank(input.expertise)) errors.expertise = "Add their expertise.";
  optionalLink(errors, "photo_url", input.photo_url);
  optionalLink(errors, "linkedin_url", input.linkedin_url);
  return errors;
}

export function validateProgram(input: { name: string; description: string | null }): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.name)) errors.name = "Add the program name.";
  if (blank(input.description)) errors.description = "Add a description.";
  return errors;
}

export function validateFaq(input: { question: string; answer: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.question)) errors.question = "Add the question.";
  if (blank(input.answer)) errors.answer = "Add the answer.";
  return errors;
}

export function validateCollection(input: { name: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.name)) errors.name = "Add a name for the collection.";
  return errors;
}

export function validateCollectionItem(input: { title: string; image_url: string | null; link_url: string | null }): FieldErrors {
  const errors: FieldErrors = {};
  if (blank(input.title)) errors.title = "Add a title.";
  optionalLink(errors, "image_url", input.image_url);
  optionalLink(errors, "link_url", input.link_url);
  return errors;
}

/** The one line shown at the foot of the form when a save is blocked. */
export const NOT_SAVED_SUMMARY = "Fix the fields marked in red, then save again.";

/**
 * Brings the first invalid field into view. Some editors are long, and Save sits at the
 * bottom, so the field that blocked the save is often off screen. Waits a frame so the
 * error state has rendered and the field carries aria-invalid.
 */
export function revealFirstError() {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
  });
}
