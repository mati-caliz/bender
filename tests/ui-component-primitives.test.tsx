import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Icon } from "@/ui/components/Icon";
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfirmBar,
  CopyButton,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Notice,
  SearchInput,
  Segmented,
  Select,
  Stat,
  Switch,
  TextArea,
  TextInput,
} from "@/ui/components/primitives";

const COPY_FEEDBACK_MS = 1200;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Icon", () => {
  it("renders a decorative svg with the requested size", () => {
    const { container } = render(<Icon name="bolt" size={20} className="brand" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toBe("brand");
  });

  it("uses the default size when none is given", () => {
    const { container } = render(<Icon name="alert" />);

    expect(container.querySelector("svg")?.getAttribute("height")).toBe("15");
    expect(container.querySelectorAll("line")).toHaveLength(2);
  });
});

describe("Switch", () => {
  it("reports the opposite state without bubbling the click", () => {
    const onChange = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <Switch checked={false} onChange={onChange} title="Prender" small />
      </div>,
    );
    const toggle = screen.getByRole("switch");

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(toggle.className).toBe("switch small");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("uses the regular size by default", () => {
    render(<Switch checked onChange={vi.fn()} />);

    expect(screen.getByRole("switch").className).toBe("switch");
  });
});

describe("Button and IconButton", () => {
  it("builds the class list from variant and size", () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="danger" small icon="trash" onClick={onClick}>
          Borrar
        </Button>
        <Button>Normal</Button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Borrar" }).className).toBe("btn danger small");
    expect(screen.getByRole("button", { name: "Normal" }).className).toBe("btn");
  });

  it("IconButton exposes its title as label and stops propagation", () => {
    const onClick = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <IconButton icon="trash" title="Borrar" tone="danger" small onClick={onClick} />
        <IconButton icon="plus" title="Agregar" onClick={vi.fn()} disabled />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Borrar" }).className).toBe("icon-btn danger small");
    expect(screen.getByRole("button", { name: "Agregar" }).className).toBe("icon-btn");
  });
});

describe("form inputs", () => {
  it("Field shows the hint only when present", () => {
    const { container, rerender } = render(
      <Field label="Nombre" hint="Obligatorio">
        <span>control</span>
      </Field>,
    );

    expect(screen.getByText("Obligatorio")).toBeTruthy();

    rerender(
      <Field label="Nombre">
        <span>control</span>
      </Field>,
    );

    expect(container.querySelector(".field-hint")).toBeNull();
  });

  it("TextInput, TextArea and Select report the typed value", () => {
    const onText = vi.fn();
    const onArea = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <TextInput value="" onChange={onText} placeholder="valor" mono />
        <TextArea value="" onChange={onArea} placeholder="cuerpo" />
        <Select
          value="a"
          onChange={onSelect}
          options={[
            { value: "a", label: "Primero" },
            { value: "b", label: "Segundo" },
          ]}
        />
      </>,
    );

    fireEvent.change(screen.getByPlaceholderText("valor"), { target: { value: "hola" } });
    fireEvent.change(screen.getByPlaceholderText("cuerpo"), { target: { value: "texto" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });

    expect(onText).toHaveBeenCalledWith("hola");
    expect(onArea).toHaveBeenCalledWith("texto");
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(screen.getByPlaceholderText("valor").className).toBe("input mono");
    expect(screen.getByPlaceholderText("cuerpo").getAttribute("rows")).toBe("4");
  });

  it("SearchInput reports the search text", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Buscar" />);

    fireEvent.change(screen.getByPlaceholderText("Buscar"), { target: { value: "api" } });

    expect(onChange).toHaveBeenCalledWith("api");
  });
});

describe("display primitives", () => {
  it("Card renders header parts only when they have content", () => {
    const { container, rerender } = render(<Card flush>cuerpo</Card>);

    expect(container.querySelector(".card-header")).toBeNull();
    expect(container.querySelector(".card-body.flush")).toBeTruthy();

    rerender(
      <Card title="Perfil" subtitle="Detalle" actions={<button type="button">Editar</button>}>
        cuerpo
      </Card>,
    );

    expect(screen.getByText("Perfil")).toBeTruthy();
    expect(screen.getByText("Detalle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();

    rerender(<Card title="Solo titulo">cuerpo</Card>);

    expect(container.querySelector(".card-subtitle")).toBeNull();
    expect(container.querySelector(".view-actions")).toBeNull();
  });

  it("Badge and Notice apply the tone class", () => {
    render(
      <>
        <Badge>neutro</Badge>
        <Badge tone="danger">rojo</Badge>
        <Notice>info</Notice>
        <Notice tone="warning">cuidado</Notice>
        <Notice tone="success">listo</Notice>
      </>,
    );

    expect(screen.getByText("neutro").className).toBe("badge");
    expect(screen.getByText("rojo").className).toBe("badge danger");
    expect(screen.getByText("info").parentElement?.className).toBe("notice");
    expect(screen.getByText("cuidado").parentElement?.className).toBe("notice warning");
    expect(screen.getByText("cuidado").parentElement?.querySelectorAll("line")).toHaveLength(2);
    expect(screen.getByText("listo").parentElement?.querySelectorAll("line")).toHaveLength(0);
  });

  it("EmptyState and Stat show optional text only when given", () => {
    const { container } = render(
      <>
        <EmptyState
          icon="cookie"
          title="Sin cookies"
          text="No hay nada"
          action={<button type="button">Crear</button>}
        />
        <EmptyState icon="cookie" title="Vacio" />
        <Stat label="Reglas" value="3" hint="activas" />
        <Stat label="Scripts" value="0" />
      </>,
    );

    expect(screen.getByText("No hay nada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crear" })).toBeTruthy();
    expect(container.querySelectorAll(".empty-text")).toHaveLength(1);
    expect(screen.getByText("activas")).toBeTruthy();
    expect(container.querySelectorAll(".stat-hint")).toHaveLength(1);
  });

  it("Segmented marks the current option and reports the chosen one", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        value="dark"
        onChange={onChange}
        options={[
          { value: "dark", label: "Oscuro" },
          { value: "light", label: "Claro" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Claro" }));

    expect(onChange).toHaveBeenCalledWith("light");
    expect(screen.getByRole("button", { name: "Oscuro" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Claro" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("Chip removes itself through its labelled button", () => {
    const onRemove = vi.fn();
    render(<Chip label="api.test" onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar api.test" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmBar", () => {
  it("confirms with the danger tone by default and cancels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmBar message="¿Borrar todo?" confirmLabel="Borrar" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Borrar" }).className).toBe("btn danger small");
  });

  it("uses the primary variant for the primary tone", () => {
    render(
      <ConfirmBar
        message="¿Aplicar?"
        confirmLabel="Aplicar"
        tone="primary"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Aplicar" }).className).toBe("btn primary small");
  });
});

describe("Dialog", () => {
  it("closes from the backdrop and the close button but not from inside", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Importar" onClose={onClose} footer={<button type="button">Ok</button>}>
        <p>contenido</p>
      </Dialog>,
    );

    fireEvent.click(screen.getByText("contenido"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("presentation"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Importar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ok" })).toBeTruthy();
  });

  it("omits the footer when there is nothing to show", () => {
    const { container } = render(
      <Dialog title="Ver" onClose={vi.fn()}>
        cuerpo
      </Dialog>,
    );

    expect(container.querySelector(".dialog-footer")).toBeNull();
  });
});

describe("CopyButton", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });

  it("copies the value and shows the feedback until the timeout", async () => {
    vi.useFakeTimers();
    render(<CopyButton value="secreto" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("secreto");
    expect(screen.getByRole("button", { name: "Copiado" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS);
    });

    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
  });
});
