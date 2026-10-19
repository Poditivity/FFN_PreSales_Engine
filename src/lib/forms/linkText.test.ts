import { describe, expect, it } from "vitest";
import { fillName, splitLinks } from "./linkText";

describe("splitLinks", () => {
  it("leaves plain text alone, line breaks included", () => {
    expect(splitLinks("One\n\nTwo")).toEqual([{ kind: "text", text: "One\n\nTwo" }]);
  });

  it("turns [label](url) into a link", () => {
    expect(splitLinks("Read [the guide](https://ffn.org/guide) first")).toEqual([
      { kind: "text", text: "Read " },
      { kind: "link", text: "the guide", href: "https://ffn.org/guide" },
      { kind: "text", text: " first" },
    ]);
  });

  it("links a bare address without its trailing full stop", () => {
    expect(splitLinks("See https://ffn.org/faq.")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "https://ffn.org/faq", href: "https://ffn.org/faq" },
      { kind: "text", text: "." },
    ]);
  });

  it("never links a javascript: address", () => {
    expect(splitLinks("[x](javascript:alert(1))")).toEqual([{ kind: "text", text: "[x](javascript:alert(1))" }]);
  });
});

describe("fillName", () => {
  it("puts the name in", () => {
    expect(fillName("Thank you, {name}!", " Asha ")).toBe("Thank you, Asha!");
  });

  it("drops the token cleanly when there is no name", () => {
    expect(fillName("Thank you {name}!", "")).toBe("Thank you!");
    expect(fillName("Thank you, {name}!", "")).toBe("Thank you!");
    expect(fillName("{name}, we have your application.", "")).toBe("we have your application.");
  });

  it("leaves a message without the token unchanged", () => {
    expect(fillName("Thanks.", "Asha")).toBe("Thanks.");
  });
});
