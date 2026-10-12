import type { Viewport } from "next";
import { ForceLightTheme } from "./ForceLightTheme";

// The applicant hub is always light. Dark mode is a choice staff make for the
// admin; an applicant opening their link has made no such choice, and the page
// is designed and checked against the light tokens. Four things keep it light:
//  - the viewport colour scheme tells the browser not to darken the page;
//  - this wrapper scopes the light tokens to the page, whatever <html> says;
//  - the inline script runs before the page paints, so a visitor whose system
//    prefers dark never sees a dark flash;
//  - ForceLightTheme holds <html> on light while the page is open and puts the
//    saved choice back when the visitor leaves for the admin.
// Declared on the document, not just the wrapper: a browser or phone that
// darkens pages on its own (Chrome and Samsung "force dark", for example) only
// leaves a page alone when the page itself says it supports light only.
export const viewport: Viewport = { colorScheme: "light" };

const LIGHT_NOW = `document.documentElement.setAttribute("data-theme","light");`;

export default function HubLayout({ children }: LayoutProps<"/hub/[token]">) {
  return (
    <div data-theme="light" className="flex flex-1 flex-col" style={{ background: "var(--surface-page)", colorScheme: "light" }}>
      <script dangerouslySetInnerHTML={{ __html: LIGHT_NOW }} />
      <ForceLightTheme />
      {children}
    </div>
  );
}
