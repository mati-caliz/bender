import { NETWORK_LOG_KEY } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import type { MockHitPayload } from '@/lib/messages';
import type { CapturedBodies, EngineDiagnostic, NetworkEntry, NetworkPhase } from '@/types';

const FLUSH_DELAY_MS = 400;
const PERSISTED_ENTRY_LIMIT = 200;
const PENDING_MATCH_TTL_MS = 10_000;
const BLOCKED_ERROR_PATTERN = /BLOCKED_BY_CLIENT|ERR_BLOCKED/i;
const ALL_URLS_FILTER: chrome.webRequest.RequestFilter = { urls: ['<all_urls>'] };

interface PendingRuleMatch {
  labels: string[];
  recordedAt: number;
}

let entries: NetworkEntry[] = [];
let maxEntries = 500;
let onlyModified = false;
let listening = false;
let flushHandle: number | null = null;
let persistenceError: string | null = null;
const entriesById = new Map<string, NetworkEntry>();
const pendingRuleMatches = new Map<string, PendingRuleMatch>();

const persist = async (): Promise<void> => {
  const persisted = entries.slice(Math.max(0, entries.length - PERSISTED_ENTRY_LIMIT));
  try {
    await chrome.storage.session.set({ [NETWORK_LOG_KEY]: persisted });
    persistenceError = null;
  } catch (error) {
    persistenceError = errorMessage(error, 'error desconocido');
  }
};

const scheduleFlush = (): void => {
  if (flushHandle !== null) return;
  flushHandle = setTimeout(() => {
    flushHandle = null;
    void persist();
  }, FLUSH_DELAY_MS) as unknown as number;
};

const indexEntries = (): void => {
  entriesById.clear();
  for (const entry of entries) entriesById.set(entry.id, entry);
};

const trim = (): void => {
  if (entries.length <= maxEntries) return;
  const removed = entries.splice(0, entries.length - maxEntries);
  for (const entry of removed) entriesById.delete(entry.id);
};

const findEntry = (requestId: string): NetworkEntry | undefined => entriesById.get(requestId);

const upsert = (entry: NetworkEntry): void => {
  const existing = entriesById.get(entry.id);
  if (existing) {
    entries[entries.indexOf(existing)] = entry;
  } else {
    entries.push(entry);
  }
  entriesById.set(entry.id, entry);
  trim();
  scheduleFlush();
};

const prunePendingRuleMatches = (): void => {
  const cutoff = Date.now() - PENDING_MATCH_TTL_MS;
  for (const [requestId, pending] of pendingRuleMatches) {
    if (pending.recordedAt < cutoff) pendingRuleMatches.delete(requestId);
  }
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
  matchedRuleLabels: pendingRuleMatches.get(details.requestId)?.labels ?? [],
  source: 'network',
  requestBody: null,
  responseBody: null,
  bodyTruncated: false,
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
    prunePendingRuleMatches();
    const pending = pendingRuleMatches.get(requestId)?.labels ?? [];
    pendingRuleMatches.set(requestId, { labels: [...pending, label], recordedAt: Date.now() });
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
  pendingRuleMatches.clear();
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
  const restored: unknown = stored[NETWORK_LOG_KEY];
  if (!Array.isArray(restored)) return;
  entries = restored as NetworkEntry[];
  indexEntries();
};

export const networkLogDiagnostics = (): EngineDiagnostic[] =>
  persistenceError
    ? [{ level: 'warning', message: `El log de trafico no se pudo guardar en la sesion: ${persistenceError}` }]
    : [];

export const listNetworkEntries = (): NetworkEntry[] => {
  const visible = onlyModified ? entries.filter((entry) => entry.matchedRuleLabels.length > 0) : entries;
  return [...visible].reverse();
};

export const clearNetworkLog = (): void => {
  entries = [];
  entriesById.clear();
  pendingRuleMatches.clear();
  void persist();
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
    requestBody: null,
    responseBody: null,
    bodyTruncated: false,
  });
};

export const recordCapturedBodies = (bodies: CapturedBodies, tabId: number): void => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry || entry.source !== 'network') continue;
    if (entry.tabId !== tabId || entry.url !== bodies.url || entry.method !== bodies.method) continue;
    if (entry.responseBody !== null) continue;

    entry.requestBody = bodies.requestBody;
    entry.responseBody = bodies.responseBody;
    entry.bodyTruncated = bodies.truncated;
    scheduleFlush();
    return;
  }
};
