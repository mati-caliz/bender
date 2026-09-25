import { toDnrResourceTypes } from "@/lib/dnr-enums";

export const TAB_ID = 7;
export const REQUEST_URL = "https://api.local/users";

export const requestDetails = (
  requestId: string,
  overrides: Partial<chrome.webRequest.WebRequestBodyDetails> = {},
): chrome.webRequest.WebRequestBodyDetails => ({
  requestId,
  url: REQUEST_URL,
  method: "GET",
  frameId: 0,
  parentFrameId: -1,
  tabId: TAB_ID,
  type: "xmlhttprequest",
  timeStamp: 1000,
  requestBody: null,
  ...overrides,
});

export const sendHeadersDetails = (
  requestId: string,
  requestHeaders: chrome.webRequest.HttpHeader[],
): chrome.webRequest.WebRequestHeadersDetails => ({
  ...requestDetails(requestId),
  requestHeaders,
  documentId: "document-1",
  documentLifecycle: "active",
  frameType: "outermost_frame",
});

export const responseDetails = (
  requestId: string,
  overrides: Partial<chrome.webRequest.WebResponseCacheDetails> = {},
): chrome.webRequest.WebResponseCacheDetails => ({
  ...requestDetails(requestId),
  statusCode: 200,
  statusLine: "HTTP/1.1 200 OK",
  fromCache: false,
  ...overrides,
});

export const redirectDetails = (requestId: string): chrome.webRequest.WebRedirectionResponseDetails => ({
  ...responseDetails(requestId, { statusCode: 302, statusLine: "HTTP/1.1 302 Found" }),
  redirectUrl: "https://api.local/elsewhere",
});

export const errorDetails = (
  requestId: string,
  error: string,
): chrome.webRequest.WebResponseErrorDetails => ({
  ...responseDetails(requestId, { timeStamp: 1500 }),
  error,
});

const xmlHttpRequestType = (): chrome.declarativeNetRequest.ResourceType => {
  const [resourceType] = toDnrResourceTypes(["xmlhttprequest"]);
  if (resourceType === undefined) throw new Error("xmlhttprequest deberia ser un tipo de recurso de DNR");
  return resourceType;
};

export const ruleMatch = (
  requestId: string,
  ruleId: number,
): chrome.declarativeNetRequest.MatchedRuleInfoDebug => ({
  request: {
    requestId,
    frameId: 0,
    method: "GET",
    partentFrameId: -1,
    tabId: TAB_ID,
    type: xmlHttpRequestType(),
    url: REQUEST_URL,
  },
  rule: { ruleId, rulesetId: "_session" },
});
