import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "@/ui/components/CodeEditor";

vi.mock("@/ui/components/CodeMirrorEditor", () => new Promise<never>(() => undefined));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CodeEditor fallback textarea", () => {
  it("indents with two spaces on Tab while CodeMirror loads", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const onChange = vi.fn();
    render(<CodeEditor value="abcd" onChange={onChange} placeholder="// codigo" minHeight={80} />);
    const textarea = screen.getByPlaceholderText("// codigo");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("Falta el textarea");
    textarea.setSelectionRange(1, 1);

    fireEvent.keyDown(textarea, { key: "Tab" });
    for (const frame of frames) frame(0);

    expect(onChange).toHaveBeenCalledWith("a  bcd");
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.style.minHeight).toBe("80px");
  });

  it("ignores other keys and reports typed text", () => {
    const onChange = vi.fn();
    render(<CodeEditor value="" onChange={onChange} placeholder="// codigo" />);
    const textarea = screen.getByPlaceholderText("// codigo");

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "let x" } });
    expect(onChange).toHaveBeenCalledWith("let x");
  });
});
