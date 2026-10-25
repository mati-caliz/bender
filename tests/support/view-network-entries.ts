import { createDefaultState } from "@/lib/constants";
import type { NetworkEntry, ToolkitState } from "@/types";
import type { FakeChrome } from "./fake-chrome";

export const networkEntry = (overrides: Partial<NetworkEntry> = {}): NetworkEntry => ({
  id: "req-1",
  tabId: 7,
  url: "https://api.example.com/api/users?page=2",
  method: "GET",
  resourceType: "xmlhttprequest",
  phase: "complete",
  statusCode: 200,
  statusLine: "HTTP/1.1 200 OK",
  fromCache: false,
  startedAt: 1_700_000_000_000,
  finishedAt: 1_700_000_000_120,
  error: null,
  requestHeaders: [{ name: "Accept", value: "application/json" }],
  responseHeaders: [{ name: "content-type", value: "application/json" }],
  matchedRuleIds: [],
  matchedRuleLabels: [],
  source: "network",
  requestBody: null,
  responseBody: null,
  bodyTruncated: false,
  ...overrides,
});

export interface NetworkBackground {
  entries: NetworkEntry[];
  messages: unknown[];
}

const typeOf = (message: unknown): unknown =>
  typeof message === "object" && message !== null && "type" in message ? message.type : undefined;

export const installNetworkBackground = (fake: FakeChrome, entries: NetworkEntry[]): NetworkBackground => {
  const background: NetworkBackground = { entries, messages: [] };
  fake.runtime.sendMessage.mockImplementation((message) => {
    background.messages.push(message);
    const type = typeOf(message);
    if (type === "network/list") return Promise.resolve(background.entries);
    if (type === "network/clear") background.entries = [];
    return Promise.resolve(null);
  });
  return background;
};

export const stateWithNetwork = (network: Partial<ToolkitState["network"]>): ToolkitState => {
  const state = createDefaultState();
  return { ...state, network: { ...state.network, ...network } };
};
