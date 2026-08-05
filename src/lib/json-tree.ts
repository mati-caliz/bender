export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonNode {
  /** Identifica al nodo dentro del arbol; sirve de key de React y de estado de plegado. */
  path: string;
  label: string;
  kind: JsonKind;
  children: JsonNode[];
  /** Texto corto para mostrar al lado del label cuando el nodo esta plegado. */
  preview: string;
  /** Solo para las hojas: el valor crudo, para poder copiarlo. */
  raw: string | null;
}

const MAX_PREVIEW_CHARS = 48;

export const jsonKindOf = (value: JsonValue): JsonKind => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
};

export const isBranch = (kind: JsonKind): boolean => kind === 'object' || kind === 'array';

const clip = (text: string): string =>
  text.length > MAX_PREVIEW_CHARS ? `${text.slice(0, MAX_PREVIEW_CHARS - 1)}…` : text;

export const previewOf = (value: JsonValue): string => {
  const kind = jsonKindOf(value);
  if (kind === 'array') return `[${(value as JsonValue[]).length}]`;
  if (kind === 'object') return `{${Object.keys(value as object).length}}`;
  if (kind === 'string') return clip(`"${value as string}"`);
  return String(value);
};

/** El valor crudo de una hoja: el texto sin comillas, para que copiarlo sirva. */
const rawOf = (value: JsonValue): string | null => {
  const kind = jsonKindOf(value);
  if (isBranch(kind)) return null;
  return kind === 'string' ? (value as string) : String(value);
};

export const buildJsonTree = (value: JsonValue, label = '', path = '$'): JsonNode => {
  const kind = jsonKindOf(value);
  let children: JsonNode[] = [];

  if (kind === 'array') {
    children = (value as JsonValue[]).map((item, index) => buildJsonTree(item, String(index), `${path}.${index}`));
  } else if (kind === 'object') {
    children = Object.entries(value as Record<string, JsonValue>).map(([key, item]) =>
      buildJsonTree(item, key, `${path}.${key}`)
    );
  }

  return { path, label, kind, children, preview: previewOf(value), raw: rawOf(value) };
};

/**
 * Devuelve el arbol solo si el texto es un objeto o un array. Un string o un
 * numero sueltos son JSON validos pero no ganan nada mostrados como arbol.
 */
export const parseJsonTree = (text: string): JsonNode | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const kind = jsonKindOf(parsed as JsonValue);
    if (!isBranch(kind)) return null;
    return buildJsonTree(parsed as JsonValue);
  } catch {
    return null;
  }
};

/** Los paths de todas las ramas, para poder expandir o plegar todo de una. */
export const branchPaths = (node: JsonNode): string[] => {
  if (!isBranch(node.kind)) return [];
  return [node.path, ...node.children.flatMap(branchPaths)];
};
