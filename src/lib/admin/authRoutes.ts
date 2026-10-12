// Screens a person reaches while signing in, or right after a code or link has
// signed them in but before they have finished. They are full-page and must
// never sit inside the admin shell (sidebar and command palette), even when a
// session already exists.
const BARE_ROUTES = ["/admin/login", "/admin/set-password"] as const;

export function isBareAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return BARE_ROUTES.some((route) => pathname === route || pathname === `${route}/`);
}
