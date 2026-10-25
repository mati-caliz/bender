import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToasts } from "@/ui/hooks/useToasts";

const TOAST_DURATION_MS = 2600;

const Notifier = (): ReactElement => {
  const { notify } = useToasts();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          notify("Guardado");
        }}
      >
        neutral
      </button>
      <button
        type="button"
        onClick={() => {
          notify("Fallo la copia", "error");
        }}
      >
        error
      </button>
    </>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("shows each notification with its tone, neutral by default", () => {
    render(
      <ToastProvider>
        <Notifier />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("neutral"));
    fireEvent.click(screen.getByText("error"));

    expect(screen.getByText("Guardado").getAttribute("data-tone")).toBe("neutral");
    expect(screen.getByText("Fallo la copia").getAttribute("data-tone")).toBe("error");
  });

  it("expires each toast on its own after the display time", () => {
    render(
      <ToastProvider>
        <Notifier />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("neutral"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByText("error"));

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    });
    expect(screen.queryByText("Guardado")).toBeNull();
    expect(screen.getByText("Fallo la copia")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Fallo la copia")).toBeNull();
  });

  it("does nothing when used outside the provider", () => {
    const { container } = render(<Notifier />);

    fireEvent.click(screen.getByText("error"));

    expect(screen.queryByText("Fallo la copia")).toBeNull();
    expect(container.querySelector(".toast-stack")).toBeNull();
  });
});
