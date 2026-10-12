import { describe, expect, it } from "vitest";
import { isBareAuthRoute } from "./authRoutes";

describe("isBareAuthRoute", () => {
  it("is true for the sign-in and set-password screens, with or without a trailing slash", () => {
    expect(isBareAuthRoute("/admin/login")).toBe(true);
    expect(isBareAuthRoute("/admin/login/")).toBe(true);
    expect(isBareAuthRoute("/admin/set-password")).toBe(true);
  });

  it("is false for every screen that belongs inside the admin shell", () => {
    for (const path of ["/admin", "/admin/leads", "/admin/settings", "/admin/profile", "/admin/login-history", "/admin/set-password/x"]) {
      expect(isBareAuthRoute(path)).toBe(false);
    }
  });

  it("is false when the pathname is not known yet", () => {
    expect(isBareAuthRoute(null)).toBe(false);
    expect(isBareAuthRoute(undefined)).toBe(false);
  });
});
