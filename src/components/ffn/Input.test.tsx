import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("shows an eye button on a password field that reveals and hides what was typed", () => {
    render(<Input type="password" label="Password" defaultValue="secret" />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("does not submit the form when the eye button is pressed", () => {
    let submitted = false;
    render(
      <form onSubmit={(e) => { e.preventDefault(); submitted = true; }}>
        <Input type="password" label="Password" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(submitted).toBe(false);
  });

  it("adds no button to other inputs", () => {
    render(<Input type="email" label="Email" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Input type=date", () => {
  it("offers a visible calendar button that opens the browser's picker", () => {
    const showPicker = vi.fn();
    render(<Input label="Date of birth" type="date" />);
    const field = screen.getByLabelText("Date of birth") as HTMLInputElement;
    field.showPicker = showPicker;
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(showPicker).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(field);
  });

  it("still works in a browser without showPicker, and other types get no calendar button", () => {
    const { rerender } = render(<Input label="Date" type="date" />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Open calendar" }))).not.toThrow();
    rerender(<Input label="Date" type="text" />);
    expect(screen.queryByRole("button", { name: "Open calendar" })).toBeNull();
  });

  it("has no calendar button when the field is disabled", () => {
    render(<Input label="Date" type="date" disabled />);
    expect(screen.getByRole("button", { name: "Open calendar" })).toBeDisabled();
  });
});
