export const patternForHostname = (hostname: string): string => (hostname ? `https://${hostname}/*` : "");

export const uniqueAppend = (existing: string[], additions: string[]): string[] =>
  Array.from(new Set([...existing, ...additions]));
