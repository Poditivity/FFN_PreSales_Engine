import { describe, expect, it } from "vitest";
import { renderSystemEmail } from "./systemEmail";
import { SYSTEM_EMAIL_KEYS, SYSTEM_EMAIL_TEMPLATES } from "./systemTemplates";
import { unknownVariables } from "./messageText";

const TABLE = '<table data-answers="1"><tr><td>Why</td></tr></table>';

describe("system email defaults", () => {
  it("only use variables they offer", () => {
    for (const key of SYSTEM_EMAIL_KEYS) {
      const def = SYSTEM_EMAIL_TEMPLATES[key];
      expect(unknownVariables(`${def.subject} ${def.body}`, def.variables)).toEqual([]);
    }
  });

  it("follow the house voice: no contractions and no em dashes", () => {
    for (const key of SYSTEM_EMAIL_KEYS) {
      const text = `${SYSTEM_EMAIL_TEMPLATES[key].subject} ${SYSTEM_EMAIL_TEMPLATES[key].body}`;
      expect(text).not.toMatch(/\w'\w|—|&mdash;/);
    }
  });
});

describe("renderSystemEmail", () => {
  it("fills the applicant's name, the form title and their answers into the default", () => {
    const { subject, html } = renderSystemEmail("submission_received", null, {
      name: "Ananya",
      vars: { form_title: "Validation Lab" },
      answersHtml: TABLE,
    });
    expect(subject).toBe('Your submission for "Validation Lab" has been received');
    expect(html).toContain("Hi Ananya,");
    expect(html).toContain("<strong>Validation Lab</strong>");
    expect(html).toContain(TABLE);
    expect(html).not.toContain("{{");
  });

  it("greets by 'there' when the applicant gave no name", () => {
    const { html } = renderSystemEmail("submission_received", null, { name: "", vars: { form_title: "X" }, answersHtml: "" });
    expect(html).toContain("Hi there,");
  });

  it("sends the team's edited wording instead of the default", () => {
    const { subject, html } = renderSystemEmail(
      "submission_received",
      { subject: "Thanks, {{name}}", body: "<p>We got {{form_title}}.</p>{{answers}}" },
      { name: "Ananya", vars: { form_title: "Validation Lab" }, answersHtml: TABLE },
    );
    expect(subject).toBe("Thanks, Ananya");
    expect(html).toContain("We got Validation Lab.");
    expect(html).toContain(TABLE);
  });

  it("falls back to the default when the stored row is blank", () => {
    const { subject } = renderSystemEmail("hub_ready", { subject: " ", body: "<p></p>" }, { name: "A", vars: { track: "Startup Lab", hub_link: "https://x.test/hub/1", booking_link: "" } });
    expect(subject).toBe("Your Startup Lab hub is ready");
  });

  it("links the hub and the booking page in the hub email", () => {
    const { html } = renderSystemEmail("hub_ready", null, {
      name: "Ananya",
      vars: { track: "Startup Lab", hub_link: "https://x.test/hub/1", booking_link: "https://cal.test/ffn" },
    });
    expect(html).toContain('href="https://x.test/hub/1"');
    expect(html).toContain('href="https://cal.test/ffn"');
  });

  it("leaves out the booking sentence when there is no booking link", () => {
    const { html } = renderSystemEmail("hub_ready", null, {
      name: "Ananya",
      vars: { track: "Startup Lab", hub_link: "https://x.test/hub/1", booking_link: "" },
    });
    expect(html).not.toContain("book time with us");
    expect(html).not.toContain("{{");
  });

  it("escapes a name so it cannot inject markup", () => {
    const { html } = renderSystemEmail("hub_ready", null, {
      name: "<script>x</script>",
      vars: { track: "T", hub_link: "https://x.test/hub/1", booking_link: "" },
    });
    expect(html).not.toContain("<script>");
  });

  it("builds the team notice from the submitter and the answers", () => {
    const { subject, html } = renderSystemEmail("admin_new_submission", null, {
      vars: { form_title: "Validation Lab", submitter: "Ananya · a@x.test", submitter_email: "a@x.test" },
      answersHtml: TABLE,
    });
    expect(subject).toBe("New submission: Validation Lab");
    expect(html).toContain("Ananya · a@x.test");
    expect(html).toContain(TABLE);
  });
});
