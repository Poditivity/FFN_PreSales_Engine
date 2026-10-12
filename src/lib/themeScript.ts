// Server-safe half of the theme code: the layout imports this, so it must not
// pull in React hooks. The hooks live in ./theme.ts.

export type Theme = "light" | "dark";

export const THEME_KEY = "ffn_theme";

/**
 * Runs in <head> before first paint so a dark-mode visitor never sees a flash
 * of the light theme. A saved choice wins; otherwise the operating system's
 * preference decides. The applicant hub (/hub/...) is the exception: it is
 * always light, so it never reads either. Kept as a string because it is
 * inlined, not bundled.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(location.pathname.indexOf("/hub/")===0){document.documentElement.setAttribute("data-theme","light");return}var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
