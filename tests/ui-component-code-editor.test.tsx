import { EditorView } from "@codemirror/view";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "@/ui/components/CodeEditor";
import CodeMirrorEditor from "@/ui/components/CodeMirrorEditor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const editorViewIn = (container: HTMLElement): EditorView => {
  const editorElement = container.querySelector(".cm-editor");
  if (!(editorElement instanceof HTMLElement)) throw new Error("CodeMirror no se monto");
  const view = EditorView.findFromDOM(editorElement);
  if (view === null) throw new Error("Falta la vista de CodeMirror");
  return view;
};

describe("CodeEditor", () => {
  it("shows the toolbar only when given and swaps in CodeMirror", async () => {
    const { container, rerender } = render(<CodeEditor value="a" onChange={vi.fn()} />);

    expect(container.querySelector(".code-toolbar")).toBeNull();

    rerender(<CodeEditor value="a" onChange={vi.fn()} toolbar={<button type="button">Formatear</button>} />);

    expect(screen.getByRole("button", { name: "Formatear" })).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });
  });
});

describe("CodeMirrorEditor", () => {
  it("mounts with the initial document and reports edits", () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeMirrorEditor
        value="body {}"
        language="css"
        onChange={onChange}
        placeholder="/* css */"
        minHeight={60}
      />,
    );
    const view = editorViewIn(container);

    expect(view.state.doc.toString()).toBe("body {}");
    expect(container.querySelector(".cm-host")).toHaveProperty("style.minHeight", "60px");

    act(() => {
      view.dispatch({ changes: { from: 0, insert: "a " } });
    });

    expect(onChange).toHaveBeenCalledWith("a body {}");
  });

  it("does not report selection-only updates", () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeMirrorEditor value="const a = 1;" language="javascript" onChange={onChange} />,
    );

    act(() => {
      editorViewIn(container).dispatch({ selection: { anchor: 2 } });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("syncs outside value changes without rebuilding the editor", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CodeMirrorEditor value="uno" language="javascript" onChange={onChange} />,
    );
    const view = editorViewIn(container);

    rerender(<CodeMirrorEditor value="dos" language="javascript" onChange={onChange} />);

    expect(editorViewIn(container)).toBe(view);
    expect(view.state.doc.toString()).toBe("dos");

    rerender(<CodeMirrorEditor value="dos" language="javascript" onChange={vi.fn()} />);

    expect(view.state.doc.toString()).toBe("dos");
  });

  it("uses the latest onChange callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = render(
      <CodeMirrorEditor value="" language="javascript" onChange={first} />,
    );

    rerender(<CodeMirrorEditor value="" language="javascript" onChange={second} />);
    act(() => {
      editorViewIn(container).dispatch({ changes: { from: 0, insert: "x" } });
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("x");
  });

  it("rebuilds the editor when the language changes and destroys it on unmount", () => {
    const { container, rerender, unmount } = render(
      <CodeMirrorEditor value="a" language="javascript" onChange={vi.fn()} />,
    );
    const firstView = editorViewIn(container);
    const destroySpy = vi.spyOn(firstView, "destroy");

    rerender(<CodeMirrorEditor value="a" language="css" onChange={vi.fn()} />);

    expect(destroySpy).toHaveBeenCalledTimes(1);
    const secondView = editorViewIn(container);
    expect(secondView).not.toBe(firstView);

    const secondDestroy = vi.spyOn(secondView, "destroy");
    unmount();

    expect(secondDestroy).toHaveBeenCalledTimes(1);
  });
});
