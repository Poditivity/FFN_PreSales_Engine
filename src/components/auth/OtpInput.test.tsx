import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./OtpInput";
import { isCompleteCode, sanitizeDigits, secondsLeft } from "./otp";

function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [value, setValue] = useState("");
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

const box = (i: number) => screen.getByTestId(`otp-${i}`) as HTMLInputElement;
const values = () => Array.from({ length: 6 }, (_, i) => box(i).value).join("");

describe("otp helpers", () => {
  it("keeps digits only and caps at six", () => {
    expect(sanitizeDigits("123 456")).toBe("123456");
    expect(sanitizeDigits("12-34-56-78")).toBe("123456");
    expect(sanitizeDigits("abc")).toBe("");
  });

  it("recognises a complete code", () => {
    expect(isCompleteCode("123456")).toBe(true);
    expect(isCompleteCode("12345")).toBe(false);
    expect(isCompleteCode("1234567")).toBe(false);
  });

  it("counts a cooldown down to zero and no further", () => {
    expect(secondsLeft(10_000, 4_500)).toBe(6);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 20_000)).toBe(0);
  });
});

describe("OtpInput", () => {
  it("renders exactly six single-digit boxes", () => {
    render(<Harness />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByRole("group", { name: "6 digit code" })).toBeInTheDocument();
  });

  it("moves focus forward as digits are typed and reports the full code once", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    "493027".split("").forEach((d, i) => {
      fireEvent.change(box(i), { target: { value: d } });
    });
    expect(values()).toBe("493027");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("493027");
  });

  it("fills every box from a pasted code, ignoring spaces and dashes", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(box(0), { clipboardData: { getData: () => "493-027" } });
    expect(values()).toBe("493027");
    expect(onComplete).toHaveBeenCalledWith("493027");
  });

  it("refuses letters", () => {
    render(<Harness />);
    fireEvent.change(box(0), { target: { value: "a" } });
    expect(values()).toBe("");
  });

  it("does not call onComplete for a partial code", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(box(0), { clipboardData: { getData: () => "4930" } });
    expect(values()).toBe("4930");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("Backspace on an empty box removes the digit before it", () => {
    render(<Harness />);
    fireEvent.paste(box(0), { clipboardData: { getData: () => "4930" } });
    fireEvent.keyDown(box(4), { key: "Backspace" });
    expect(values()).toBe("493");
  });

  it("marks every box invalid and exposes a label for each digit", () => {
    render(<OtpInput value="" onChange={() => {}} invalid />);
    expect(screen.getByLabelText("Digit 1 of 6")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Digit 6 of 6")).toBeInTheDocument();
  });
});
