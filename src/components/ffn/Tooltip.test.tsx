import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows its label on hover and hides it when the pointer leaves", () => {
    render(
      <Tooltip label="Copy the hub link">
        <Button aria-label="Copy link">x</Button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Copy link" }).parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copy the hub link");
    fireEvent.mouseLeave(screen.getByRole("button", { name: "Copy link" }).parentElement!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on keyboard focus and closes on Escape", () => {
    render(
      <Tooltip label="View activity">
        <Button aria-label="View activity">x</Button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "View activity" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
