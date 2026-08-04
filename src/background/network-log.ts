import { NETWORK_LOG_KEY } from '@/lib/constants';
import type { MockHitPayload } from '@/lib/messages';
import type { NetworkEntry, NetworkPhase } from '@/types';

const FLUSH_DELAY_MS = 400;
const BLOCKED_ERROR_PATTERN = /BLOCKED_BY_CLIENT|ERR_BLOCKED/i;
const ALL_URLS_FILTER: chrome.webRequest.RequestFilter = { urls: ['<all_urls>'] };

let entries: NetworkEntry[] = [];
let maxEntries = 500;
let onlyModified = false;
let listening = false;
let flushHandle: number | null = null;
const pendingRuleMatches = new Map<string, string[]>();

const scheduleFlush = (): void => {
  if (flushHandle !== null) return;
  flushHandle = setTimeout(() => {
    flushHandle = null;
    void chrome.storage.session.set({ [NETWORK_LOG_KEY]: entries });
  }, FLUSH_DELAY_MS) as unknown as number;
};

const trim = (): void => {
  if (entries.length > maxEntries) entries = entries.slice(entries.length - maxEntries);
};

const findEntry = (requestId: string): NetworkEntry | undefined =>
  entries.find((entry) => entry.id === requestId);

const upsert = (entry: NetworkEntry): void => {
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
    trim();
  }
  scheduleFlush();
};

const createEntry = (details: chrome.webRequest.WebRequestBodyDetails): NetworkEntry => ({
  id: details.requestId,
  tabId: details.tabId,
  url: details.url,
  method: details.method,
  resourceType: details.type,
  phase: 'pending',
  statusCode: null,
  statusLine: '',
  fromCache: false,
  startedAt: details.timeStamp,
  finishedAt: null,
  error: null,
  requestHeaders: [],
  responseHeaders: [],
  matchedRuleIds: [],
  matchedRuleLabels: pendingRuleMatches.get(details.requestId) ?? [],
  source: 'network',
});

const toHeaderList = (headers: chrome.webRequest.HttpHeader[] | undefined): Array<{ name: string; value: string }> =>
  (headers ?? []).map((header) => ({ name: header.name, value: header.value ?? '' }));

const handleBeforeRequest = (details: chrome.webRequest.WebRequestBodyDetails): void => {
  pendingRuleMatches.delete(details.requestId);
  upsert(createEntry(details));
};

const handleSendHeaders = (details: chrome.webRequest.WebRequestHeadersDetails): void => {
  const entry = findEntry(details.requestId);
  if (!entry) return;
  entry.requestHeaders = toHeaderList(details.requestHeaders);
  scheduleFlush();
};

const handleHeadersReceived = (details: chrome.webRequest.WebResponseHeadersDetails): void => {
  const entry = findEntry(details.requestId);
  if (!entry) return;
  entry.responseHeaders = toHeaderList(details.responseHeaders);
  entry.statusCode = details.statusCode;
  entry.statusLine = details.statusLine;
  scheduleFlush();
};

const handleBeforeRedirect = (details: chrome.webRequest.WebRedirectionResponseDetails): void => {
  const entry = findEntry(details.requestId);
  if (!entry) return;
  entry.phase = 'redirected';
  entry.statusCode = details.statusCode;
  scheduleFlush();
};

const handleCompleted = (details: chrome.webRequest.WebResponseCacheDetails): void => {
  const entry = findEntry(details.requestId);
  if (!entry) return;
  entry.phase = 'complete';
  entry.statusCode = details.statusCode;
  entry.fromCache = details.fromCache;
  entry.finishedAt = details.timeStamp;
  scheduleFlush();
};

const handleErrorOccurred = (details: chrome.webRequest.WebResponseErrorDetails): void => {
  const entry = findEntry(details.requestId);
  if (!entry) return;
  entry.phase = BLOCKED_ERROR_PATTERN.test(details.error) ? 'blocked' : 'error';
  entry.error = details.error;
  entry.finishedAt = details.timeStamp;
  scheduleFlush();
};

let ruleLabels: Record<number, string> = {};

export const setRuleLabels = (labels: Record<number, string>): void => {
  ruleLabels = labels;
};

const handleRuleMatched = (info: chrome.declarativeNetRequest.MatchedRuleInfoDebug): void => {
  const requestId = info.request.requestId;
  const label = ruleLabels[info.rule.ruleId] ?? `Regla #${info.rule.ruleId}`;
  const entry = findEntry(requestId);
  if (!entry) {
    const pending = pendingRuleMatches.get(requestId) ?? [];
    pendingRuleMatches.set(requestId, [...pending, label]);
    return;
  }
  if (!entry.matchedRuleIds.includes(info.rule.ruleId)) {
    entry.matchedRuleIds.push(info.rule.ruleId);
    entry.matchedRuleLabels.push(label);
    scheduleFlush();
  }
};

const attach = (): void => {
  if (listening) return;
  listening = true;
  chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest, ALL_URLS_FILTER);
  chrome.webRequest.onSendHeaders.addListener(handleSendHeaders, ALL_URLS_FILTER, ['requestHeaders', 'extraHeaders']);
  chrome.webRequest.onHeadersReceived.addListener(handleHeadersReceived, ALL_URLS_FILTER, [
    'responseHeaders',
    'extraHeaders',
  ]);
  chrome.webRequest.onBeforeRedirect.addListener(handleBeforeRedirect, ALL_URLS_FILTER);
  chrome.webRequest.onCompleted.addListener(handleCompleted, ALL_URLS_FILTER);
  chrome.webRequest.onErrorOccurred.addListener(handleErrorOccurred, ALL_URLS_FILTER);
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(handleRuleMatched);
  }
};

const detach = (): void => {
  if (!listening) return;
  listening = false;
  chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest);
  chrome.webRequest.onSendHeaders.removeListener(handleSendHeaders);
  chrome.webRequest.onHeadersReceived.removeListener(handleHeadersReceived);
  chrome.webRequest.onBeforeRedirect.removeListener(handleBeforeRedirect);
  chrome.webRequest.onCompleted.removeListener(handleCompleted);
  chrome.webRequest.onErrorOccurred.removeListener(handleErrorOccurred);
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.removeListener(handleRuleMatched);
  }
};

export const configureNetworkLog = (config: { enabled: boolean; maxEntries: number; onlyModified: boolean }): void => {
  maxEntries = config.maxEntries;
  onlyModified = config.onlyModified;
  trim();
  if (config.enabled) {
    attach();
  } else {
    detach();
  }
};

export const restoreNetworkLog = async (): Promise<void> => {
  const stored = await chrome.storage.session.get(NETWORK_LOG_KEY);
  const restored = stored[NETWORK_LOG_KEY];
  if (Array.isArray(restored)) entries = restored as NetworkEntry[];
};

export const listNetworkEntries = (): NetworkEntry[] => {
  const visible = onlyModified ? entries.filter((entry) => entry.matchedRuleLabels.length > 0) : entries;
  return [...visible].reverse();
};

export const clearNetworkLog = (): void => {
  entries = [];
  pendingRuleMatches.clear();
  void chrome.storage.session.set({ [NETWORK_LOG_KEY]: entries });
};

export const recordMockHit = (payload: MockHitPayload, tabId: number): void => {
  const phase: NetworkPhase = 'mocked';
  upsert({
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tabId,
    url: payload.url,
    method: payload.method,
    resourceType: 'xmlhttprequest',
    phase,
    statusCode: payload.status,
    statusLine: `HTTP/1.1 ${payload.status}`,
    fromCache: false,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    error: null,
    requestHeaders: [],
    responseHeaders: [],
    matchedRuleIds: [],
    matchedRuleLabels: [`Mock · ${payload.ruleName}`],
    source: 'mock',
  });
};
