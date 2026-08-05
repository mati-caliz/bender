import type { UserScriptRunAt } from '@/types';

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

const HEADER_BLOCK = /\/\/\s*==UserScript==\s*\n([\s\S]*?)\n\s*\/\/\s*==\/UserScript==/;
const HEADER_LINE = /^\s*\/\/\s*@(\S+)\s*(.*)$/;

/** Tampermonkey usa document-start; chrome.userScripts usa document_start. */
const RUN_AT_BY_TAG: Record<string, UserScriptRunAt> = {
  'document-start': 'document_start',
  'document-end': 'document_end',
  'document-idle': 'document_idle',
  'document-body': 'document_end',
};

const EMPTY_HEADER: UserScriptHeader = {
  name: null,
  description: null,
  matches: [],
  excludeMatches: [],
  runAt: null,
};

/**
 * `@include` y `@exclude` de Greasemonkey admiten patrones que no son match
 * patterns de Chrome, pero los casos comunes (`*://host/*`, `*`) coinciden, asi
 * que se leen igual. Uno invalido lo rechaza despues chrome.userScripts.
 */
export const parseUserScriptHeader = (code: string): UserScriptHeader => {
  const block = HEADER_BLOCK.exec(code);
  if (!block?.[1]) return EMPTY_HEADER;

  const header: UserScriptHeader = { ...EMPTY_HEADER, matches: [], excludeMatches: [] };

  for (const line of block[1].split('\n')) {
    const parsed = HEADER_LINE.exec(line);
    if (!parsed) continue;

    const tag = (parsed[1] ?? '').toLowerCase();
    const value = (parsed[2] ?? '').trim();
    if (!value) continue;

    switch (tag) {
      case 'name':
        header.name ??= value;
        break;
      case 'description':
        header.description ??= value;
        break;
      case 'match':
      case 'include':
        header.matches.push(value);
        break;
      case 'exclude':
      case 'exclude-match':
        header.excludeMatches.push(value);
        break;
      case 'run-at':
        header.runAt ??= RUN_AT_BY_TAG[value.toLowerCase()] ?? null;
        break;
      default:
        break;
    }
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
  if (header.name) parts.push(`nombre "${header.name}"`);
  if (header.matches.length) parts.push(`${header.matches.length} patron(es)`);
  if (header.excludeMatches.length) parts.push(`${header.excludeMatches.length} exclusion(es)`);
  if (header.runAt) parts.push(`run-at ${header.runAt}`);
  return parts.join(' · ');
};
