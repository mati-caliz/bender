export type ResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'other';

export type HeaderOperation = 'set' | 'append' | 'remove';

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
  operation: HeaderOperation;
  enabled: boolean;
  comment: string;
}

export interface Scope {
  activeTabOnly: boolean;
  includeDomains: string[];
  excludeDomains: string[];
  urlFilter: string;
  resourceTypes: ResourceType[];
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  scope: Scope;
  requestHeaders: HeaderEntry[];
  responseHeaders: HeaderEntry[];
}

export type TrafficRuleAction =
  | { kind: 'block' }
  | { kind: 'redirect'; target: string; useRegex: boolean }
  | { kind: 'mock'; status: number; contentType: string; body: string; delayMs: number; headers: HeaderEntry[] };

export interface TrafficRule {
  id: string;
  name: string;
  enabled: boolean;
  scope: Scope;
  action: TrafficRuleAction;
}

export type CorsAllowOrigin = 'wildcard' | 'reflect' | 'custom';

export interface CorsConfig {
  enabled: boolean;
  allowOrigin: CorsAllowOrigin;
  customOrigin: string;
  allowCredentials: boolean;
  allowMethods: string;
  allowHeaders: string;
  exposeHeaders: string;
  maxAgeSeconds: number;
  removeContentSecurityPolicy: boolean;
  removeFrameOptions: boolean;
  scope: Scope;
}

export interface UserAgentConfig {
  enabled: boolean;
  presetId: string;
  value: string;
  spoofClientHints: boolean;
  spoofNavigator: boolean;
  scope: Scope;
}

export interface NetworkConfig {
  enabled: boolean;
  maxEntries: number;
  captureBodies: boolean;
  onlyModified: boolean;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export interface UiConfig {
  theme: ThemeMode;
  accent: string;
  lastView: string;
  density: 'comfortable' | 'compact';
}

export type UserScriptLanguage = 'javascript' | 'css';

export type UserScriptRunAt = 'document_start' | 'document_end' | 'document_idle';

export type UserScriptWorld = 'MAIN' | 'USER_SCRIPT';

export interface UserScript {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  language: UserScriptLanguage;
  matches: string[];
  excludeMatches: string[];
  runAt: UserScriptRunAt;
  world: UserScriptWorld;
  allFrames: boolean;
  code: string;
  updatedAt: number;
}

export interface UserScriptsStatus {
  supported: boolean;
  registeredCount: number;
  error: string | null;
}

export interface ToolkitState {
  schemaVersion: number;
  globalEnabled: boolean;
  profiles: Profile[];
  selectedProfileId: string | null;
  trafficRules: TrafficRule[];
  userScripts: UserScript[];
  cors: CorsConfig;
  userAgent: UserAgentConfig;
  network: NetworkConfig;
  ui: UiConfig;
}

export interface EngineDiagnostic {
  level: 'error' | 'warning';
  message: string;
}

export interface EngineStatus {
  appliedRuleCount: number;
  activeProfileCount: number;
  diagnostics: EngineDiagnostic[];
  updatedAt: number;
}

export type NetworkPhase = 'pending' | 'complete' | 'error' | 'blocked' | 'redirected' | 'mocked';

export interface NetworkEntry {
  id: string;
  tabId: number;
  url: string;
  method: string;
  resourceType: string;
  phase: NetworkPhase;
  statusCode: number | null;
  statusLine: string;
  fromCache: boolean;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  requestHeaders: Array<{ name: string; value: string }>;
  responseHeaders: Array<{ name: string; value: string }>;
  matchedRuleIds: number[];
  matchedRuleLabels: string[];
  source: 'network' | 'mock';
}

export interface StoredItem {
  key: string;
  value: string;
}

export interface ToggleRow<T> {
  key: string;
  item: T;
  off: boolean;
  reappeared: boolean;
}

export type StorageArea = 'local' | 'session';

export interface MockDefinition {
  id: string;
  name: string;
  scope: Scope;
  status: number;
  contentType: string;
  body: string;
  delayMs: number;
  headers: Array<{ name: string; value: string }>;
}

export type BridgeMessage =
  | { channel: 'bender'; type: 'mocks'; mocks: MockDefinition[] }
  | { channel: 'bender'; type: 'mock-hit'; url: string; method: string; ruleName: string; status: number };
