import type { CssVariable, DesignAudit } from "@/types";
import { AUDITED_PROPERTIES, type PageStyleSample, summarizeElementStyles } from "@/lib/design-summary";

const MAX_AUDITED_ELEMENTS = 4000;
const MAX_AUDIT_RESULTS = 60;

// Lo que se inyecta con chrome.scripting.executeScript({ func }) se serializa solo, así que todo lo
// que usa en tiempo de ejecución tiene que estar declarado adentro (los tipos no cuentan). Por eso en
// la pestaña sólo se leen los estilos, y el conteo se hace del lado de la extensión.

/** Los valores computados de `properties` en cada elemento visible, hasta `maxElements` elementos. */
export const readVisibleElementStyles = (maxElements: number, properties: string[]): PageStyleSample => {
  const hasOwnText = (element: Element): boolean =>
    Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
    );
  const isHidden = (styles: CSSStyleDeclaration): boolean =>
    styles.display === "none" || styles.visibility === "hidden";

  // lib.dom tipa document.body como no nulo, pero es null mientras el documento no tiene <body>.
  const bodyOrNull = (): HTMLElement | null => document.body;
  const elements = Array.from((bodyOrNull() ?? document.documentElement).querySelectorAll("*")).slice(0, maxElements);
  const visibleElements = elements.flatMap((element) => {
    const styles = window.getComputedStyle(element);
    if (isHidden(styles)) return [];
    const values = Object.fromEntries(properties.map((property) => [property, styles.getPropertyValue(property)]));
    return [{ hasOwnText: hasOwnText(element), styles: values }];
  });
  return { elementCount: elements.length, visibleElements };
};

interface SheetAudit {
  rootFontSize: number;
  variables: CssVariable[];
}

/** El tamaño de letra de la raíz y las variables CSS declaradas en `:root`. */
export const auditPageSheets = (maxResults: number): SheetAudit => {
  const DEFAULT_ROOT_FONT_SIZE = 16;

  const readSheetRules = (sheet: CSSStyleSheet): CSSRule[] => {
    try {
      return Array.from(sheet.cssRules);
    } catch {
      // Una hoja de otro origen tira SecurityError al leer cssRules.
      return [];
    }
  };

  const rootVariablesOf = (rule: CSSRule): CssVariable[] =>
    rule instanceof CSSStyleRule && rule.selectorText.includes(":root")
      ? Array.from(rule.style)
          .filter((property) => property.startsWith("--"))
          .map((property) => ({ name: property, value: rule.style.getPropertyValue(property).trim() }))
      : [];

  const variables = Array.from(document.styleSheets, readSheetRules).flat().flatMap(rootVariablesOf);
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));

  return {
    rootFontSize: Number.isNaN(rootFontSize) || rootFontSize === 0 ? DEFAULT_ROOT_FONT_SIZE : rootFontSize,
    variables: Array.from(variablesByName.values()).slice(0, maxResults),
  };
};

/** Corre las auditorías en la pestaña y las junta; null si alguna no devolvió nada. */
export const fetchDesignAudit = async (tabId: number): Promise<DesignAudit | null> => {
  const target = { tabId };
  const [elements, sheets] = await Promise.all([
    chrome.scripting.executeScript({
      target,
      func: readVisibleElementStyles,
      args: [MAX_AUDITED_ELEMENTS, AUDITED_PROPERTIES],
    }),
    chrome.scripting.executeScript({ target, func: auditPageSheets, args: [MAX_AUDIT_RESULTS] }),
  ]);
  const styleSample = elements[0]?.result;
  const sheetAudit = sheets[0]?.result;
  if (styleSample === undefined || sheetAudit === undefined) return null;
  return { ...summarizeElementStyles(styleSample, MAX_AUDIT_RESULTS), ...sheetAudit };
};
