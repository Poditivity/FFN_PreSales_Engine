import { describe, expect, it } from "vitest";
import { buildCoFounderAdjacency, coFoundersOf, normalizePair } from "./coFounders";

describe("normalizePair", () => {
  it("orders the smaller id first regardless of call order", () => {
    expect(normalizePair("b", "a")).toEqual(["a", "b"]);
    expect(normalizePair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("buildCoFounderAdjacency / coFoundersOf — symmetric linking", () => {
  it("surfaces a link on both founders regardless of storage side", () => {
    // Stored as (a, b) per the DB's canonical-order constraint.
    const pairs = [{ founder_id_a: "founder-a", founder_id_b: "founder-b" }];

    expect(coFoundersOf("founder-a", pairs)).toEqual(["founder-b"]);
    expect(coFoundersOf("founder-b", pairs)).toEqual(["founder-a"]);
  });

  it("handles a founder with multiple co-founders", () => {
    const pairs = [
      { founder_id_a: "founder-a", founder_id_b: "founder-b" },
      { founder_id_a: "founder-a", founder_id_b: "founder-c" },
    ];

    expect(coFoundersOf("founder-a", pairs).sort()).toEqual(["founder-b", "founder-c"]);
    expect(coFoundersOf("founder-b", pairs)).toEqual(["founder-a"]);
    expect(coFoundersOf("founder-c", pairs)).toEqual(["founder-a"]);
  });

  it("returns an empty list for a founder with no links", () => {
    const pairs = [{ founder_id_a: "founder-a", founder_id_b: "founder-b" }];
    expect(coFoundersOf("founder-z", pairs)).toEqual([]);
  });

  it("builds a full adjacency map across several pairs", () => {
    const pairs = [
      { founder_id_a: "a", founder_id_b: "b" },
      { founder_id_a: "b", founder_id_b: "c" },
    ];
    const adjacency = buildCoFounderAdjacency(pairs);

    expect(adjacency.get("a")).toEqual(["b"]);
    expect(adjacency.get("b")?.sort()).toEqual(["a", "c"]);
    expect(adjacency.get("c")).toEqual(["b"]);
  });
});
