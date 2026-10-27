import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BLOCK_TYPES, defaultModule, moduleKey, newRepeatableModule, type HubModule } from "@/lib/hubs/types";
import { ModuleComposer, normalizeModules, reorderModules } from "./ModuleComposer";

vi.mock("@/lib/content/collections", () => ({
  listCollectionsWithItems: () =>
    Promise.resolve([{ id: "col-1", name: "Events", items: [{ id: "item-1", label: "Demo day" }] }]),
}));
// The rich text editor and image field talk to the browser editing APIs and storage.
vi.mock("@/app/admin/messaging/RichTextEditor", () => ({ RichTextEditor: () => <div>editor</div> }));
vi.mock("@/components/content/ImageUploadField", () => ({ ImageUploadField: () => <div>image</div> }));

const noItems = Object.fromEntries(BLOCK_TYPES.map((t) => [t, []])) as never;
const types = (modules: HubModule[]) => modules.map((m) => m.type);

describe("normalizeModules", () => {
  it("starts a new list in the standard order", () => {
    expect(types(normalizeModules([]))).toEqual([...BLOCK_TYPES]);
  });

  it("keeps the order it is given, including custom sections", () => {
    const custom = newRepeatableModule("custom", "Our story");
    const standard = BLOCK_TYPES.map((t) => defaultModule(t));
    // FAQs moved to the front, a custom section in the middle.
    const given = [standard.find((m) => m.type === "faqs")!, ...standard.filter((m) => m.type !== "faqs")];
    given.splice(4, 0, custom);
    const result = normalizeModules(given);
    expect(result.map((m) => m.id ?? m.type)).toEqual(given.map((m) => m.id ?? m.type));
  });

  it("slots a missing fixed block in after the one before it in the standard order", () => {
    const withoutMentors = BLOCK_TYPES.filter((t) => t !== "mentors").map((t) => defaultModule(t));
    expect(types(normalizeModules(withoutMentors))).toEqual([...BLOCK_TYPES]);
  });
});

describe("reorderModules", () => {
  const list = BLOCK_TYPES.map((t) => defaultModule(t));
  const keys = (mods: HubModule[]) => mods.map(moduleKey);

  it("moves a section before or after another", () => {
    const [a, b, c, d] = keys(list);
    expect(keys(reorderModules(list, d, b, "before")).slice(0, 4)).toEqual([a, d, b, c]);
    expect(keys(reorderModules(list, a, c, "after")).slice(0, 4)).toEqual([b, c, a, d]);
  });

  it("leaves the list alone when dropped on itself or an unknown section", () => {
    const [a] = keys(list);
    expect(reorderModules(list, a, a, "before")).toBe(list);
    expect(reorderModules(list, a, "nope", "before")).toBe(list);
  });
});

describe("ModuleComposer defaults", () => {
  it("fills a section's default title and subtitle into the boxes, and shows the default selection", () => {
    render(<ModuleComposer value={[]} onChange={() => {}} itemsByType={noItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Founders" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Founders");
    expect(screen.getByLabelText("Subtitle")).toHaveValue("Open a profile to read the whole story.");
    expect(screen.getByText("Default: Automatic, every item that suits the track, no limit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automatic (default)" })).toBeInTheDocument();
  });

  it("keeps a default that depends on the applicant out of the box and describes it instead", () => {
    render(<ModuleComposer value={[]} onChange={() => {}} itemsByType={noItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Welcome" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByText(/Welcome, \{applicant name\}, filled in for each applicant/)).toBeInTheDocument();
  });

  it("saves null again when a box is left empty or matches the default", () => {
    const onChange = vi.fn();
    const edited = [{ ...defaultModule("founders"), title: "" }];
    render(<ModuleComposer value={edited} onChange={onChange} itemsByType={noItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Founders" }));
    fireEvent.blur(screen.getByLabelText("Title"));
    const next = onChange.mock.calls[0][0].find((m: { type: string }) => m.type === "founders");
    expect(next.title).toBeNull();
  });

  it("always offers Reset to default, on an untouched section too, and resets it", () => {
    const onChange = vi.fn();
    const edited = [{ ...defaultModule("founders"), title: "Our founders", limit: 3 }];
    render(<ModuleComposer value={edited} onChange={onChange} itemsByType={noItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Founders" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    const next = onChange.mock.calls[0][0].find((m: { type: string }) => m.type === "founders");
    expect(next).toEqual(defaultModule("founders"));

    fireEvent.click(screen.getByRole("button", { name: "Configure Mentors" }));
    expect(screen.getAllByRole("button", { name: "Reset to default" }).length).toBeGreaterThan(0);
  });
});

describe("ModuleComposer custom sections", () => {
  it("adds a custom section at the end under the name it is given, and opens it", () => {
    const onChange = vi.fn();
    render(<ModuleComposer value={[]} onChange={onChange} itemsByType={noItems} />);
    fireEvent.change(screen.getByLabelText("Section name"), { target: { value: "Our story" } });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    const next = onChange.mock.calls[0][0] as HubModule[];
    const added = next[next.length - 1];
    expect(added).toMatchObject({ type: "custom", title: "Our story", enabled: true });
    expect(added.id).toMatch(/^custom-our-story-[a-z0-9]{4}$/);
  });

  it("will not add a section with no name", () => {
    render(<ModuleComposer value={[]} onChange={() => {}} itemsByType={noItems} />);
    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
  });

  it("moves a section up and down, and removes only custom sections", () => {
    const onChange = vi.fn();
    const custom = newRepeatableModule("custom", "Our story");
    render(<ModuleComposer value={[...normalizeModules([]), custom]} onChange={onChange} itemsByType={noItems} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Our story up" }));
    const moved = onChange.mock.calls[0][0] as HubModule[];
    expect(moved[moved.length - 2].id).toBe(custom.id);

    fireEvent.click(screen.getByRole("button", { name: "Remove Our story" }));
    const removed = onChange.mock.calls[1][0] as HubModule[];
    expect(removed.some((m) => m.id === custom.id)).toBe(false);
    expect(removed).toHaveLength(BLOCK_TYPES.length);

    expect(screen.queryByRole("button", { name: "Remove Founders" })).not.toBeInTheDocument();
  });

  it("moves a section when its handle is dragged onto another section", () => {
    const onChange = vi.fn();
    const custom = newRepeatableModule("custom", "Our story");
    const modules = [...normalizeModules([]), custom];
    render(<ModuleComposer value={modules} onChange={onChange} itemsByType={noItems} />);

    const handle = screen.getByRole("img", { name: "Drag Our story to move it" });
    const target = document.querySelector<HTMLElement>(`[data-section-key="${moduleKey(modules[2])}"]`)!;
    const dataTransfer = { setData: () => {}, setDragImage: () => {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(handle, { dataTransfer });
    // jsdom has no layout, so every box is 0 tall and clientY 0 reads as "after".
    fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
    fireEvent.drop(target, { dataTransfer });

    const moved = onChange.mock.calls[0][0] as HubModule[];
    expect(moved.indexOf(moved.find((m) => m.id === custom.id)!)).toBe(3);
    expect(moved).toHaveLength(modules.length);
  });

  it("gives every section a drag handle, Welcome included", () => {
    render(<ModuleComposer value={[]} onChange={() => {}} itemsByType={noItems} />);
    expect(screen.getByRole("img", { name: "Drag Welcome to move it" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Drag Founders to move it" })).toBeInTheDocument();
  });

  it("lists a collection's items for a hand-picked collection section", async () => {
    const section: HubModule = { ...newRepeatableModule("collection", "Events"), collection_id: "col-1", mode: "manual" };
    render(<ModuleComposer value={[section]} onChange={() => {}} itemsByType={noItems} />);
    fireEvent.click(await screen.findByRole("button", { name: "Configure Events" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Demo day" })).toBeInTheDocument());
  });
});
