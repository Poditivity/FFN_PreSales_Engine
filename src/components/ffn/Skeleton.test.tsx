import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton, RowsSkeleton, Skeleton } from "./Skeleton";
import { AuthSkeleton, HubSkeleton, PublicFormSkeleton } from "./PublicSkeletons";

describe("skeletons", () => {
  it("hide their blocks from a screen reader and announce one loading status", () => {
    const { container } = render(<PageSkeleton variant="list" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading")).toBeInTheDocument();
    for (const block of container.querySelectorAll(".ffn-skeleton")) expect(block).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".ffn-skeleton").length).toBeGreaterThan(5);
  });

  it("draw a layout for every page shape", () => {
    for (const variant of ["list", "cards", "detail", "form"] as const) {
      const { container, unmount } = render(<PageSkeleton variant={variant} />);
      expect(container.querySelectorAll(".ffn-skeleton").length).toBeGreaterThan(3);
      unmount();
    }
  });

  it("take a label for the status they announce", () => {
    render(<RowsSkeleton rows={2} label="Loading the team" />);
    expect(screen.getByText("Loading the team")).toBeInTheDocument();
  });

  it("use tokens and percentages for size, never raw pixels", () => {
    const { container } = render(
      <>
        <PageSkeleton variant="detail" />
        <AuthSkeleton />
        <PublicFormSkeleton />
        <HubSkeleton />
      </>,
    );
    for (const el of container.querySelectorAll<HTMLElement>(".ffn-skeleton")) {
      expect(el.getAttribute("style") ?? "").not.toMatch(/\d\s*px/);
    }
  });

  it("can be a circle", () => {
    const { container } = render(<Skeleton circle width="var(--space-8)" height="var(--space-8)" />);
    expect(container.firstChild).toHaveClass("ffn-skeleton", "ffn-skeleton--circle");
  });

  it("have a loading page for the public form, the hub and sign-in", () => {
    for (const el of [<PublicFormSkeleton key="a" />, <HubSkeleton key="b" />, <AuthSkeleton key="c" />]) {
      const { unmount } = render(el);
      expect(screen.getByRole("status")).toBeInTheDocument();
      unmount();
    }
  });
});
