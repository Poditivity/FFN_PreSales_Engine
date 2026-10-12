import { describe, expect, it } from "vitest";
import {
  isHttpUrl,
  validateCaseStudy,
  validateCollection,
  validateCollectionItem,
  validateFaq,
  validateFounder,
  validateMentor,
  validateProgram,
  validateTestimonial,
  validateTrack,
} from "./validation";

describe("isHttpUrl", () => {
  it("accepts full http and https links", () => {
    expect(isHttpUrl("https://example.com/case-study")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("  https://www.linkedin.com/in/someone  ")).toBe(true);
  });

  it("rejects anything the hub could not open as a link", () => {
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("www.example.com")).toBe(false);
    expect(isHttpUrl("not a link")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://localhost")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("validateCaseStudy", () => {
  const ok = { title: "Zero to one", case_study_link: "https://example.com/files/zero-to-one.pdf" };

  it("needs a title, a working link and at least one founder", () => {
    expect(validateCaseStudy(ok, ["f1"])).toEqual({});
    expect(Object.keys(validateCaseStudy({ title: " ", case_study_link: null }, [""])).sort()).toEqual([
      "case_study_link",
      "founders",
      "title",
    ]);
  });

  it("does not accept a link that is not a link", () => {
    expect(validateCaseStudy({ ...ok, case_study_link: "see our site" }, ["f1"]).case_study_link).toMatch(/https:\/\//);
  });

  it("accepts a PDF link or a Google Drive file, and nothing else", () => {
    const drive = "https://drive.google.com/file/d/1v035OtG_pCu1pKpUqIqek5qcPzE9kHPI/view?usp=sharing";
    expect(validateCaseStudy({ ...ok, case_study_link: drive }, ["f1"])).toEqual({});
    expect(validateCaseStudy({ ...ok, case_study_link: "https://example.com/files/a.PDF?dl=1" }, ["f1"])).toEqual({});
    expect(validateCaseStudy({ ...ok, case_study_link: "https://example.com/case-studies/orbitpath" }, ["f1"]).case_study_link).toMatch(
      /PDF/,
    );
  });
});

describe("validateTestimonial", () => {
  const base = { founder_id: "f1", testimonial_quote: null, video_link: null };

  it("needs a quote or a video, either one", () => {
    expect(validateTestimonial(base).testimonial_quote).toBeDefined();
    expect(validateTestimonial({ ...base, testimonial_quote: "Great program." })).toEqual({});
    expect(validateTestimonial({ ...base, video_link: "https://youtu.be/abc.def" })).toEqual({});
  });

  it("needs a founder, and a video link that works when one is given", () => {
    expect(validateTestimonial({ ...base, founder_id: "", testimonial_quote: "x" }).founder_id).toBeDefined();
    expect(validateTestimonial({ ...base, testimonial_quote: "x", video_link: "nope" }).video_link).toBeDefined();
  });
});

describe("validateFounder", () => {
  const ok = {
    name: "Ananya Rao",
    startup_name: "AnanyaLabs",
    photo_url: null,
    startup_logo_url: null,
    website_url: null,
    linkedin_url: null,
  };

  it("needs only a name and a startup; the story fields stay optional", () => {
    expect(validateFounder(ok)).toEqual({});
    const errors = validateFounder({ ...ok, name: "", startup_name: " " });
    expect(Object.keys(errors).sort()).toEqual(["name", "startup_name"]);
  });

  it("leaves links optional but rejects one that is filled in wrongly", () => {
    expect(validateFounder({ ...ok, website_url: "https://ananya.io", linkedin_url: "https://linkedin.com/in/a" })).toEqual({});
    const errors = validateFounder({ ...ok, website_url: "ananya.io", photo_url: "photo" });
    expect(Object.keys(errors).sort()).toEqual(["photo_url", "website_url"]);
  });
});

describe("validateMentor", () => {
  it("needs a name, a role and expertise", () => {
    expect(validateMentor({ name: "Sam", role: "Partner", expertise: "Fundraising", photo_url: null, linkedin_url: null })).toEqual({});
    const errors = validateMentor({ name: "", role: null, expertise: " ", photo_url: null, linkedin_url: "linkedin" });
    expect(Object.keys(errors).sort()).toEqual(["expertise", "linkedin_url", "name", "role"]);
  });
});

describe("validateProgram", () => {
  it("needs a name and a description", () => {
    expect(validateProgram({ name: "Validation Lab", description: "Twelve weeks." })).toEqual({});
    expect(Object.keys(validateProgram({ name: " ", description: null })).sort()).toEqual(["description", "name"]);
  });
});

describe("validateFaq", () => {
  it("needs a question and an answer", () => {
    expect(validateFaq({ question: "Cost?", answer: "Free to apply." })).toEqual({});
    expect(Object.keys(validateFaq({ question: "", answer: " " })).sort()).toEqual(["answer", "question"]);
  });
});

describe("validateTrack", () => {
  it("needs a name that can become a slug", () => {
    expect(validateTrack({ name: "Validation Lab" })).toEqual({});
    expect(validateTrack({ name: "" }).name).toBeDefined();
    expect(validateTrack({ name: "!!!" }).name).toBeDefined();
  });
});

describe("validateCollection and validateCollectionItem", () => {
  it("needs a collection name", () => {
    expect(validateCollection({ name: " " })).toHaveProperty("name");
    expect(validateCollection({ name: "Events" })).toEqual({});
  });

  it("needs an item title and accepts empty optional links", () => {
    expect(validateCollectionItem({ title: "", image_url: null, link_url: null })).toHaveProperty("title");
    expect(validateCollectionItem({ title: "Demo day", image_url: null, link_url: null })).toEqual({});
  });

  it("rejects a link that is not a full http or https address", () => {
    const errors = validateCollectionItem({ title: "Demo day", image_url: "not a url", link_url: "example.com" });
    expect(errors).toHaveProperty("image_url");
    expect(errors).toHaveProperty("link_url");
    expect(validateCollectionItem({ title: "Demo day", image_url: "https://x.test/a.png", link_url: "https://x.test/demo" })).toEqual({});
  });
});
