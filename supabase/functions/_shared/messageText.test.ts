import { describe, expect, it } from "vitest";
import {
  bodyToEditorHtml,
  emailBodyToHtml,
  emailDocumentToText,
  greetingName,
  hasVisibleText,
  htmlToPlainText,
  looksLikeHtml,
  modernizeVariables,
  personalizeHtml,
  personalizeText,
  plainTextToHtml,
  sanitizeEmailHtml,
  TEMPLATE_VARIABLES,
  unknownVariables,
  usesHubLink,
} from "./messageText";

describe("variables", () => {
  it("greets by the name given and falls back to there", () => {
    expect(greetingName("  Ananya   Rao ")).toBe("Ananya Rao");
    expect(greetingName("  ")).toBe("there");
    expect(greetingName(null)).toBe("there");
  });

  it("fills {{name}} in text and tolerates spaces", () => {
    expect(personalizeText("Hi {{name}}, and {{ name }}.", "Ananya Rao")).toBe("Hi Ananya Rao, and Ananya Rao.");
    expect(personalizeText("Hi {{name}},", "")).toBe("Hi there,");
  });

  it("still resolves the older {{lead_name}} and leaves unknown tokens visible", () => {
    expect(personalizeText("{{lead_name}} / {{oops}}", "Ananya")).toBe("Ananya / {{oops}}");
    expect(personalizeText("re {{program}}", "Ananya", { program: "Validation Lab" })).toBe("re Validation Lab");
  });

  it("escapes a name placed into html", () => {
    expect(personalizeHtml("<p>Hi {{name}}</p>", '<img src=x onerror=alert(1)>')).toBe("<p>Hi &lt;img src=x onerror=alert(1)&gt;</p>");
    expect(personalizeHtml("<p>Hi {{name}}</p>", 'A&B')).toBe("<p>Hi A&amp;B</p>");
  });

  it("reports variables other than name", () => {
    expect(unknownVariables("Hi {{name}} {{program}} {{lead_name}} {{program}}")).toEqual(["{{program}}"]);
    expect(unknownVariables("Hi {{name}}")).toEqual([]);
  });

  it("modernizes the old variable", () => {
    expect(modernizeVariables("Hi {{ lead_name }}")).toBe("Hi {{name}}");
  });
});

describe("{{hub_link}}", () => {
  const url = "https://ffn.example/hub/abc123";

  it("is offered to email and no longer reported as unknown", () => {
    expect(TEMPLATE_VARIABLES.map((v) => v.token)).toEqual(["{{name}}", "{{hub_link}}"]);
    expect(unknownVariables("Hi {{name}}, your hub: {{hub_link}}")).toEqual([]);
    expect(unknownVariables("{{hub}}")).toEqual(["{{hub}}"]);
  });

  it("detects a message that uses it", () => {
    expect(usesHubLink("see {{hub_link}}")).toBe(true);
    expect(usesHubLink("see {{ hub_link }}")).toBe(true);
    expect(usesHubLink("see {{name}}")).toBe(false);
  });

  it("fills plain text and subjects with the address", () => {
    expect(personalizeText("Your hub: {{hub_link}}", "Ananya", { hub_link: url })).toBe(`Your hub: ${url}`);
  });

  it("turns the token in an email body into a clickable link", () => {
    expect(personalizeHtml("<p>Your hub: {{hub_link}}</p>", "Ananya", { hub_link: url })).toBe(
      `<p>Your hub: <a href="${url}">${url}</a></p>`,
    );
  });

  it("uses it as the address of an editor link, which writes it as https://{{hub_link}}", () => {
    const html = personalizeHtml('<p><a href="https://{{hub_link}}">https://{{hub_link}}</a></p>', "Ananya", { hub_link: url });
    expect(html).toBe(`<p><a href="${url}">${url}</a></p>`);
    // and it survives the sanitizer that every outgoing body goes through
    expect(sanitizeEmailHtml(html)).toContain(`href="${url}"`);
  });

  it("keeps a link with its own label and fills only the address", () => {
    expect(personalizeHtml('<a href="{{hub_link}}">Open your hub</a>', "A", { hub_link: url })).toBe(`<a href="${url}">Open your hub</a>`);
  });

  it("escapes the address and leaves nothing behind when there is no hub", () => {
    expect(personalizeHtml("{{hub_link}}", "A", { hub_link: 'https://x.test/?a=1&b="2"' })).toContain("a=1&amp;b=&quot;2&quot;");
    expect(sanitizeEmailHtml(personalizeHtml('<p>Hub <a href="https://{{hub_link}}">https://{{hub_link}}</a></p>', "A", { hub_link: "" }))).toBe(
      "<p>Hub </p>",
    );
    expect(personalizeHtml("<p>{{hub_link}}</p>", "A")).toBe("<p>{{hub_link}}</p>");
  });
});

describe("sanitizeEmailHtml", () => {
  it("keeps the formatting an email needs", () => {
    const html = '<p>Hello <strong>you</strong> and <em>them</em></p><ul><li>One</li></ul>';
    expect(sanitizeEmailHtml(html)).toBe(html);
  });

  it("removes scripts, styles, frames and handlers", () => {
    expect(sanitizeEmailHtml('<p onclick="x()">Hi</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>')).toBe("<p>Hi</p>");
  });

  it("allows only safe links and forces safe attributes", () => {
    expect(sanitizeEmailHtml('<a href="https://ffn.in/a?b=1&amp;c=2" onclick="x()">go</a>')).toBe(
      '<a href="https://ffn.in/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">go</a>',
    );
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">bad</a>')).toBe("bad");
    expect(sanitizeEmailHtml('<a href="  JaVaScRiPt:alert(1)">bad</a>')).toBe("bad");
    expect(sanitizeEmailHtml('<a href="mailto:hi@ffn.in">mail</a>')).toContain('href="mailto:hi@ffn.in"');
  });

  it("maps editor tags and closes what is left open", () => {
    expect(sanitizeEmailHtml("<div>Line</div><b>bold")).toBe("<p>Line</p><strong>bold</strong>");
  });

  it("escapes a stray angle bracket in text", () => {
    expect(sanitizeEmailHtml("<p>1 < 2</p>")).toBe("<p>1 &lt; 2</p>");
  });

  it("ends an open paragraph before a block tag", () => {
    expect(sanitizeEmailHtml("<p>a<ul><li>b</li></ul>")).toBe("<p>a</p><ul><li>b</li></ul>");
  });
});

describe("body conversion", () => {
  it("tells html from older plain text", () => {
    expect(looksLikeHtml("<p>Hi</p>")).toBe(true);
    expect(looksLikeHtml("Hi there,\n\nSee you 5 < 6")).toBe(false);
  });

  it("turns plain text into paragraphs and breaks, escaped", () => {
    expect(plainTextToHtml("Hi <b>\nsecond line\n\nNew paragraph")).toBe("<p>Hi &lt;b&gt;<br>second line</p><p>New paragraph</p>");
    expect(bodyToEditorHtml("Just text")).toBe("<p>Just text</p>");
  });

  it("styles the html for mail clients", () => {
    const out = emailBodyToHtml('<p>Hi <a href="https://ffn.in">link</a></p>');
    expect(out).toContain('<p style="');
    expect(out).toContain('<a style="color:#233ce6;" href="https://ffn.in"');
  });

  it("makes plain text out of html", () => {
    expect(htmlToPlainText("<p>Hi <strong>Ana</strong></p><ul><li>One</li><li>Two</li></ul><p>Bye</p>")).toBe("Hi Ana\n\n- One\n- Two\n\nBye");
    expect(htmlToPlainText('<p><a href="https://ffn.in">Site</a></p>')).toBe("Site (https://ffn.in)");
  });

  it("detects an empty editor", () => {
    expect(hasVisibleText("<p><br></p>")).toBe(false);
    expect(hasVisibleText("<p>Hi</p>")).toBe(true);
  });
});

describe("emailDocumentToText", () => {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ignored</title></head>
<body style="margin:0;">
<table width="100%"><tr><td align="center">
  <table><tr><td style="background:#0a0c12;">
    <span style="font-size:11px;">Founders First Network</span>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0;">Hi Ada &amp; team,</h1>
    <p style="margin:0;">
      Your page for the <strong>Build</strong> track is ready.
    </p>
    <table><tr><td><a href="https://example.com/hub/abc?x=1&amp;y=2" style="color:#fff;">View your hub</a></td></tr></table>
    <p>&mdash; The Founders First Network Team &#8212; it&rsquo;s here</p>
  </td></tr></table>
</td></tr></table>
</body></html>`;

  it("turns a full branded email into readable plain text", () => {
    expect(emailDocumentToText(doc)).toBe(
      [
        "Founders First Network",
        "",
        "Hi Ada & team,",
        "",
        "Your page for the Build track is ready.",
        "",
        "View your hub (https://example.com/hub/abc?x=1&y=2)",
        "",
        "— The Founders First Network Team — it’s here",
      ].join("\n"),
    );
  });

  it("never leaks markup, the doctype or the head", () => {
    const text = emailDocumentToText(doc);
    expect(text).not.toMatch(/[<>]/);
    expect(text).not.toContain("DOCTYPE");
    expect(text).not.toContain("Ignored");
  });

  it("leaves unknown entities as written", () => {
    expect(emailDocumentToText("<p>a &bogus; b</p>")).toBe("a &bogus; b");
  });
});
