import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadImage = vi.fn();
vi.mock("@/lib/content/imageUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/imageUpload")>()),
  uploadImage: (...args: unknown[]) => uploadImage(...args),
}));

import { ImageUploadField } from "./ImageUploadField";

function setup(value: string | null = null) {
  const onChange = vi.fn();
  render(<ImageUploadField label="Photo" folder="founders/photos" testId="p" value={value} onChange={onChange} />);
  return onChange;
}

const file = (type = "image/png", size = 10) => new File([new Uint8Array(size).fill(1)], "a.png", { type });

describe("ImageUploadField", () => {
  beforeEach(() => {
    uploadImage.mockReset();
  });

  it("uploads the picked file and stores the public URL it returns", async () => {
    uploadImage.mockResolvedValue("https://cdn.example.com/founders/photos/x.png");
    const onChange = setup();
    fireEvent.change(screen.getByTestId("p-input"), { target: { files: [file()] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/founders/photos/x.png"));
    expect(uploadImage).toHaveBeenCalledWith("founders/photos", expect.any(File));
  });

  it("shows a preview of the current image, and offers Replace and Remove", () => {
    const onChange = setup("https://cdn.example.com/founders/photos/x.png");
    expect(screen.getByTestId("p-preview")).toHaveAttribute("src", "https://cdn.example.com/founders/photos/x.png");
    expect(screen.getByRole("button", { name: "Replace image" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("keeps a link pasted before uploads existed exactly as it was", () => {
    setup("https://example.com/old/pasted.jpg");
    expect(screen.getByTestId("p-preview")).toHaveAttribute("src", "https://example.com/old/pasted.jpg");
  });

  it("still lets you paste a link instead of uploading", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Paste a link instead" }));
    fireEvent.change(screen.getByTestId("p-link"), { target: { value: "https://example.com/me.png" } });
    expect(onChange).toHaveBeenLastCalledWith("https://example.com/me.png");
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an image without calling the server", () => {
    const onChange = setup();
    fireEvent.change(screen.getByTestId("p-input"), { target: { files: [file("application/pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, WebP or GIF image.");
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the upload error and leaves the record unchanged when the upload fails", async () => {
    uploadImage.mockImplementation(() => Promise.reject(new Error("Uploads are not set up yet. Paste a link to the image instead.")));
    const onChange = setup();
    fireEvent.change(screen.getByTestId("p-input"), { target: { files: [file()] } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Uploads are not set up yet");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says so when the stored image does not load", () => {
    setup("https://example.com/gone.png");
    fireEvent.error(screen.getByTestId("p-preview"));
    expect(screen.getByText(/This image did not load/)).toBeInTheDocument();
  });
});
