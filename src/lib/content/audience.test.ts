import { describe, expect, it } from "vitest";
import { filterByTrack, isVisibleToTrack } from "./audience";

describe("isVisibleToTrack — audience-empty-means-everyone", () => {
  it("is visible to every track when audience is empty", () => {
    expect(isVisibleToTrack([], "track-founders")).toBe(true);
  });

  it("is visible to every track when audience is null", () => {
    expect(isVisibleToTrack(null, "track-founders")).toBe(true);
  });

  it("is visible when the track is explicitly included", () => {
    expect(isVisibleToTrack(["track-founders", "track-students"], "track-founders")).toBe(true);
  });

  it("is not visible when audience is non-empty and excludes the track", () => {
    expect(isVisibleToTrack(["track-students"], "track-founders")).toBe(false);
  });
});

describe("filterByTrack", () => {
  const rows = [
    { id: "1", audience: [] as string[] },
    { id: "2", audience: ["track-founders"] },
    { id: "3", audience: ["track-students"] },
  ];

  it("returns every row when no track is selected", () => {
    expect(filterByTrack(rows, null)).toHaveLength(3);
  });

  it("keeps empty-audience rows plus rows matching the selected track", () => {
    const result = filterByTrack(rows, "track-founders");
    expect(result.map((r) => r.id)).toEqual(["1", "2"]);
  });
});
