import { hasText } from "@/lib/text";
import type { NetworkEntry } from "@/types";

const SHELL_QUOTE_ESCAPE = "'\\''";
const DEFAULT_METHOD = "GET";

const shellQuote = (value: string): string => `'${value.split("'").join(SHELL_QUOTE_ESCAPE)}'`;

export const toCurl = (entry: NetworkEntry): string => {
  const lines = [`curl ${shellQuote(entry.url)}`];

  if (entry.method !== "" && entry.method !== DEFAULT_METHOD) lines.push(`-X ${entry.method}`);
  for (const header of entry.requestHeaders) {
    const headerLine = `${header.name}: ${header.value}`;
    lines.push(`-H ${shellQuote(headerLine)}`);
  }
  if (hasText(entry.requestBody)) lines.push(`--data-raw ${shellQuote(entry.requestBody)}`);

  return lines.join(" \\\n  ");
};

export const toFetchSnippet = (entry: NetworkEntry): string => {
  const init: Record<string, unknown> = { method: entry.method || DEFAULT_METHOD };

  if (entry.requestHeaders.length > 0) {
    init["headers"] = Object.fromEntries(entry.requestHeaders.map((header) => [header.name, header.value]));
  }
  if (hasText(entry.requestBody)) init["body"] = entry.requestBody;

  return `await fetch(${JSON.stringify(entry.url)}, ${JSON.stringify(init, null, 2)});`;
};
