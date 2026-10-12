import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForceLightTheme } from "./ForceLightTheme";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("ForceLightTheme", () => {
  it("holds the page on light even when the viewer has chosen dark", () => {
    window.localStorage.setItem("ffn_theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ForceLightTheme />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("puts the viewer's saved choice back when they leave the hub", () => {
    window.localStorage.setItem("ffn_theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    const { unmount } = render(<ForceLightTheme />);
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("goes back to light when the viewer chose light", () => {
    window.localStorage.setItem("ffn_theme", "light");
    const { unmount } = render(<ForceLightTheme />);
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
