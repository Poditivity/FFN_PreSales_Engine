import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionBlock, CustomBlock } from "./customBlocks";

// The page's IntersectionObserver-based view tracking is not under test here.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

describe("CustomBlock", () => {
  const base = { id: "custom-our-story-ab12", imageUrl: null, buttonLabel: null, buttonUrl: null, onButtonClick: () => {} };

  it("renders its heading and text under the section's own id", () => {
    const { container } = render(<CustomBlock {...base} title="Our story" subtitle={null} body="<p>We began in 2019.</p>" />);
    expect(container.querySelector("#custom-our-story-ab12")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Our story" })).toBeInTheDocument();
    expect(screen.getByText("We began in 2019.")).toBeInTheDocument();
  });

  it("strips scripts and event handlers from the text", () => {
    const { container } = render(
      <CustomBlock {...base} title="T" subtitle={null} body={'<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it("shows the button only with both a label and a link", () => {
    const { rerender } = render(<CustomBlock {...base} title="T" subtitle={null} body="<p>Hi</p>" buttonLabel="Read more" buttonUrl={null} />);
    expect(screen.queryByRole("link", { name: /Read more/ })).toBeNull();
    rerender(<CustomBlock {...base} title="T" subtitle={null} body="<p>Hi</p>" buttonLabel="Read more" buttonUrl="https://x.test/a" />);
    expect(screen.getByRole("link", { name: /Read more/ })).toHaveAttribute("href", "https://x.test/a");
  });

  it("renders nothing when there is neither text nor an image", () => {
    const { container } = render(<CustomBlock {...base} title="T" subtitle={null} body={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CollectionBlock", () => {
  it("lists the items, links out only where an item has a link, and hides when empty", () => {
    const items = [
      { id: "1", title: "Demo day", description: "Pitch to investors.", image_url: null, link_url: "https://x.test/demo" },
      { id: "2", title: "Office hours", description: null, image_url: null, link_url: null },
    ];
    const { container, rerender } = render(
      <CollectionBlock id="collection-events-ab12" items={items} title="Events" subtitle={null} onView={() => {}} onLink={() => {}} />,
    );
    expect(screen.getByRole("heading", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByText("Demo day")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    rerender(<CollectionBlock id="collection-events-ab12" items={[]} title="Events" subtitle={null} onView={() => {}} onLink={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
