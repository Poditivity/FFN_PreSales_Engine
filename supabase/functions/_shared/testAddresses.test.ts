import { describe, expect, it } from "vitest";
import { isReservedTestAddress } from "./testAddresses";

describe("isReservedTestAddress", () => {
  it("catches the reserved test domains", () => {
    for (const address of [
      "e2e-admin@example.com",
      "Someone@EXAMPLE.COM",
      "x@example.net",
      "x@example.org",
      "x@mail.test",
      "x@foo.invalid",
      "x@host.localhost",
      "x@shop.example",
    ]) {
      expect(isReservedTestAddress(address)).toBe(true);
    }
  });

  it("lets real addresses through", () => {
    for (const address of ["ada@gmail.com", "team@foundersfirstnetwork.com", "x@notexample.com", "x@example.co", "x@testing.com", ""]) {
      expect(isReservedTestAddress(address)).toBe(false);
    }
  });
});
