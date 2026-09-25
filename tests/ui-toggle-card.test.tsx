import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleCard } from "@/ui/components/ToggleCard";
import { ViewShell } from "@/ui/components/ViewShell";

afterEach(() => {
  cleanup();
});

const renderCard = (overrides: Partial<Parameters<typeof ToggleCard>[0]> = {}) => {
  const onToggle = vi.fn();
  const onExpand = vi.fn();
  const view = render(
    <ToggleCard
      name="session"
      preview="abc123"
      off={false}
      reappeared={false}
      expanded={false}
      reappearedTitle="Volvio a aparecer"
      onToggle={onToggle}
      onExpand={onExpand}
      {...overrides}
    >
      <p>detalle</p>
    </ToggleCard>,
  );
  return { ...view, onToggle, onExpand };
};

describe("ToggleCard", () => {
  it("hides the children while collapsed and expands on header click", () => {
    const { onExpand } = renderCard();

    expect(screen.queryByText("detalle")).toBeNull();
    fireEvent.click(screen.getByText("session"));

    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("shows children and the reappeared badge when flagged", () => {
    renderCard({ expanded: true, reappeared: true });

    expect(screen.getByText("detalle")).toBeTruthy();
    expect(screen.getByText("reaparecio")).toBeTruthy();
  });

  it("offers to restore a switched-off item and reports the new state", () => {
    const { onToggle } = renderCard({ off: true });

    fireEvent.click(screen.getByTitle("Restaurar"));

    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe("ViewShell", () => {
  it("renders subtitle and actions only when they have content", () => {
    const { container, rerender } = render(
      <ViewShell title="Headers" subtitle="" actions={null}>
        cuerpo
      </ViewShell>,
    );

    expect(container.querySelector(".view-subtitle")).toBeNull();
    expect(container.querySelector(".view-actions")).toBeNull();

    rerender(
      <ViewShell title="Headers" subtitle="Reglas activas" actions={<button type="button">Nuevo</button>}>
        cuerpo
      </ViewShell>,
    );

    expect(screen.getByText("Reglas activas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nuevo" })).toBeTruthy();
  });
});
