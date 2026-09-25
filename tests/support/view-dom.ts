import { screen, within, type BoundFunctions, type queries } from "@testing-library/react";

type ScopedQueries = BoundFunctions<typeof queries>;

export const closestElement = (element: Element, selector: string): HTMLElement => {
  const match = element.closest(selector);
  if (!(match instanceof HTMLElement)) throw new Error(`No se encontro ${selector} alrededor del elemento`);
  return match;
};

export const itemCardOf = (name: string): HTMLElement => closestElement(screen.getByText(name), ".item-card");

export const withinItemCard = (name: string): ScopedQueries => within(itemCardOf(name));

export const queryConfirmBar = (): HTMLElement | null => {
  const bar = document.querySelector(".confirm-bar");
  return bar instanceof HTMLElement ? bar : null;
};

export const withinConfirmBar = (): ScopedQueries => {
  const bar = queryConfirmBar();
  if (bar === null) throw new Error("No hay barra de confirmacion visible");
  return within(bar);
};

export const inputOf = (element: HTMLElement): HTMLInputElement => {
  if (!(element instanceof HTMLInputElement)) throw new Error("El elemento no es un input");
  return element;
};

export const buttonOf = (element: HTMLElement): HTMLButtonElement => {
  if (!(element instanceof HTMLButtonElement)) throw new Error("El elemento no es un boton");
  return element;
};

export const installClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
};
