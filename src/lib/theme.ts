"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type Theme } from "./themeScript";

const THEME_EVENT = "ffn-theme-change";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribeTheme(notify: () => void) {
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/** The theme this browser has chosen: the saved choice, else the operating system's preference. */
export function preferredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be blocked; fall through to the system preference.
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Private windows can refuse storage; the theme still applies to this page view.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** The theme currently on <html>. Renders as light on the server, then corrects on the client. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "light");
}
