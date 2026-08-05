import type { NetworkEntry } from '@/types';

const SHELL_QUOTE_ESCAPE = "'\\''";
const DEFAULT_METHOD = 'GET';

const shellQuote = (value: string): string => `'${value.split("'").join(SHELL_QUOTE_ESCAPE)}'`;

export const toCurl = (entry: NetworkEntry): string => {
  const lines = [`curl ${shellQuote(entry.url)}`];

  if (entry.method && entry.method !== DEFAULT_METHOD) lines.push(`-X ${entry.method}`);
  for (const header of entry.requestHeaders) {
    lines.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`);
  }
  if (entry.requestBody) lines.push(`--data-raw ${shellQuote(entry.requestBody)}`);

  return lines.join(' \\\n  ');
};

export const toFetchSnippet = (entry: NetworkEntry): string => {
  const init: Record<string, unknown> = { method: entry.method || DEFAULT_METHOD };

  if (entry.requestHeaders.length) {
    init.headers = Object.fromEntries(entry.requestHeaders.map((header) => [header.name, header.value]));
  }
  if (entry.requestBody) init.body = entry.requestBody;

  return `await fetch(${JSON.stringify(entry.url)}, ${JSON.stringify(init, null, 2)});`;
};
