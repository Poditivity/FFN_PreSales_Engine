"use client";

import { useEffect } from "react";
import { preferredTheme } from "@/lib/theme";

/** Keeps <html data-theme> on light while a public hub is open, then restores the viewer's choice. */
export function ForceLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", "light");
    return () => html.setAttribute("data-theme", preferredTheme());
  }, []);
  return null;
}
