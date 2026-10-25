import { urlMatchesScope } from "@/lib/scope";
import type { HeaderEntry, ToolkitState } from "@/types";

export interface EffectiveHeader {
  name: string;
  value: string;
  operation: HeaderEntry["operation"];
  source: string;
  direction: "request" | "response";
}

const collect = (
  entries: HeaderEntry[],
  source: string,
  direction: EffectiveHeader["direction"],
): EffectiveHeader[] =>
  entries
    .filter((entry) => entry.enabled && entry.name.trim() !== "")
    .map((entry) => ({
      name: entry.name.trim(),
      value: entry.value,
      operation: entry.operation,
      source,
      direction,
    }));

const mergeKey = (header: EffectiveHeader, mergedCount: number): string => {
  const appendSuffix = header.operation === "append" ? String(mergedCount) : "";
  return `${header.direction}:${header.name.toLowerCase()}:${appendSuffix}`;
};

const mergeProfileHeaders = (
  state: ToolkitState,
  url: string,
  merged: Map<string, EffectiveHeader>,
): void => {
  for (const profile of state.profiles) {
    if (!profile.enabled || !urlMatchesScope(profile.scope, url)) continue;
    const headers = [
      ...collect(profile.requestHeaders, profile.name, "request"),
      ...collect(profile.responseHeaders, profile.name, "response"),
    ];
    for (const header of headers) {
      merged.set(mergeKey(header, merged.size), header);
    }
  }
};

const userAgentApplies = (state: ToolkitState, url: string): boolean =>
  state.userAgent.enabled &&
  state.userAgent.value.trim() !== "" &&
  urlMatchesScope(state.userAgent.scope, url);

export const effectiveHeadersFor = (state: ToolkitState, url: string): EffectiveHeader[] => {
  if (!state.globalEnabled || !url) return [];

  const merged = new Map<string, EffectiveHeader>();
  mergeProfileHeaders(state, url, merged);

  if (userAgentApplies(state, url)) {
    merged.set("request:user-agent:", {
      name: "User-Agent",
      value: state.userAgent.value,
      operation: "set",
      source: "User-Agent",
      direction: "request",
    });
  }

  return Array.from(merged.values());
};
