import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeKeeper } from "./ThemeKeeper";

const html = document.documentElement;

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ThemeKeeper", () => {
  beforeEach(() => {
    window.localStorage.setItem("ffn_theme", "dark");
    window.history.pushState({}, "", "/admin/settings");
  });
  afterEach(() => {
    window.localStorage.clear();
    html.removeAttribute("data-theme");
  });

  it("restores the saved theme when the attribute is wiped", async () => {
    html.setAttribute("data-theme", "dark");
    render(<ThemeKeeper />);
    html.removeAttribute("data-theme");
    await flush();
    expect(html.getAttribute("data-theme")).toBe("dark");
  });

  it("puts the saved theme back when something resets it to light", async () => {
    html.setAttribute("data-theme", "light");
    render(<ThemeKeeper />);
    await flush();
    expect(html.getAttribute("data-theme")).toBe("dark");
    html.setAttribute("data-theme", "light");
    await flush();
    expect(html.getAttribute("data-theme")).toBe("dark");
  });

  it("follows a theme the viewer changes", async () => {
    render(<ThemeKeeper />);
    window.localStorage.setItem("ffn_theme", "light");
    html.setAttribute("data-theme", "light");
    await flush();
    expect(html.getAttribute("data-theme")).toBe("light");
  });

  it("keeps a public hub on light", async () => {
    window.history.pushState({}, "", "/hub/abc");
    render(<ThemeKeeper />);
    await flush();
    expect(html.getAttribute("data-theme")).toBe("light");
  });
});
