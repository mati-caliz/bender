import { hasText } from "@/lib/text";
import type { UserScriptRunAt } from "@/types";

/**
 * Metadatos que Bender sabe usar del bloque `// ==UserScript==` de Tampermonkey.
 * Lo que no entiende se ignora en silencio: el header sigue en el codigo, asi que
 * nada se pierde.
 */
export interface UserScriptHeader {
  name: string | null;
  description: string | null;
  matches: string[];
  excludeMatches: string[];
  runAt: UserScriptRunAt | null;
}

const COMMENT_PREFIX = "//";
const HEADER_START_MARKER = "==UserScript==";
const HEADER_END_MARKER = "==/UserScript==";
const TAG_PREFIX = "@";
const WHITESPACE = /\s/;
const LINE_TERMINATOR = /[\r\u2028\u2029]/;

/** Tampermonkey usa document-start; chrome.userScripts usa document_start. */
const RUN_AT_BY_TAG: Record<string, UserScriptRunAt> = {
  "document-start": "document_start",
  "document-end": "document_end",
  "document-idle": "document_idle",
  "document-body": "document_end",
};

const EMPTY_HEADER: UserScriptHeader = {
  name: null,
  description: null,
  matches: [],
  excludeMatches: [],
  runAt: null,
};

const isHeaderStart = (line: string): boolean => {
  const trimmed = line.trimEnd();
  return (
    trimmed.endsWith(HEADER_START_MARKER) &&
    trimmed.slice(0, -HEADER_START_MARKER.length).trimEnd().endsWith(COMMENT_PREFIX)
  );
};

const isHeaderEnd = (line: string): boolean => {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith(COMMENT_PREFIX) &&
    trimmed.slice(COMMENT_PREFIX.length).trimStart().startsWith(HEADER_END_MARKER)
  );
};

const headerBlockLines = (code: string): string[] => {
  const lines = code.split("\n");
  const startIndex = lines.findIndex(isHeaderStart);
  if (startIndex === -1) return [];
  const endOffset = lines.slice(startIndex + 1).findIndex(isHeaderEnd);
  return endOffset === -1 ? [] : lines.slice(startIndex + 1, startIndex + 1 + endOffset);
};

interface HeaderTag {
  tag: string;
  value: string;
}

const parseHeaderLine = (line: string): HeaderTag | null => {
  const afterIndent = line.trimStart();
  if (!afterIndent.startsWith(COMMENT_PREFIX)) return null;
  const afterComment = afterIndent.slice(COMMENT_PREFIX.length).trimStart();
  if (!afterComment.startsWith(TAG_PREFIX)) return null;

  const body = afterComment.slice(TAG_PREFIX.length);
  const tagEnd = body.search(WHITESPACE);
  const tag = tagEnd === -1 ? body : body.slice(0, tagEnd);
  const rest = body.slice(tag.length).trimStart();
  if (tag === "" || LINE_TERMINATOR.test(rest)) return null;
  return { tag: tag.toLowerCase(), value: rest.trim() };
};

type HeaderField = "name" | "description" | "matches" | "excludeMatches" | "runAt";

const FIELD_BY_TAG: Record<string, HeaderField> = {
  name: "name",
  description: "description",
  match: "matches",
  include: "matches",
  exclude: "excludeMatches",
  "exclude-match": "excludeMatches",
  "run-at": "runAt",
};

const runAtFromTag = (value: string): UserScriptRunAt | null => RUN_AT_BY_TAG[value.toLowerCase()] ?? null;

const applyTag = (header: UserScriptHeader, { tag, value }: HeaderTag): UserScriptHeader => {
  const field = FIELD_BY_TAG[tag];
  if (field === undefined) return header;
  switch (field) {
    case "name":
      return { ...header, name: header.name ?? value };
    case "description":
      return { ...header, description: header.description ?? value };
    case "matches":
      return { ...header, matches: [...header.matches, value] };
    case "excludeMatches":
      return { ...header, excludeMatches: [...header.excludeMatches, value] };
    case "runAt":
      return { ...header, runAt: header.runAt ?? runAtFromTag(value) };
  }
};

/**
 * `@include` y `@exclude` de Greasemonkey admiten patrones que no son match
 * patterns de Chrome, pero los casos comunes (`*://host/*`, `*`) coinciden, asi
 * que se leen igual. Uno invalido lo rechaza despues chrome.userScripts.
 */
export const parseUserScriptHeader = (code: string): UserScriptHeader => {
  let header = EMPTY_HEADER;
  for (const line of headerBlockLines(code)) {
    const parsed = parseHeaderLine(line);
    if (parsed !== null && parsed.value !== "") header = applyTag(header, parsed);
  }
  return header;
};

/** Si no aporta nada no vale la pena ofrecerle al usuario aplicarlo. */
export const headerHasData = (header: UserScriptHeader): boolean =>
  header.name !== null ||
  header.description !== null ||
  header.runAt !== null ||
  header.matches.length > 0 ||
  header.excludeMatches.length > 0;

export const describeHeader = (header: UserScriptHeader): string => {
  const parts: string[] = [];
  if (hasText(header.name)) parts.push(`nombre "${header.name}"`);
  if (header.matches.length > 0) parts.push(`${header.matches.length} patron(es)`);
  if (header.excludeMatches.length > 0) parts.push(`${header.excludeMatches.length} exclusion(es)`);
  if (header.runAt !== null) parts.push(`run-at ${header.runAt}`);
  return parts.join(" · ");
};
