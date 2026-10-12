"use client";

import { useEffect } from "react";
import { preferredTheme } from "./theme";

/** The theme <html> should carry on this page: always light on a public hub, otherwise the viewer's choice. */
function wantedTheme(): "light" | "dark" {
  return window.location.pathname.startsWith("/hub/") ? "light" : preferredTheme();
}

/**
 * Keeps <html data-theme> on the viewer's saved theme. The inline script in the
 * head sets it before first paint, but React can rewrite the <html> element
 * afterwards (a render error or a hydration fallback on a page rebuilds the
 * document root and drops attributes it did not set), which sent a dark-mode
 * viewer back to light on refresh. This puts the attribute back whenever it
 * stops matching.
 */
export function ThemeKeeper() {
  useEffect(() => {
    const html = document.documentElement;
    const repair = () => {
      const wanted = wantedTheme();
      if (html.getAttribute("data-theme") !== wanted) html.setAttribute("data-theme", wanted);
    };
    repair();
    const observer = new MutationObserver(repair);
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
