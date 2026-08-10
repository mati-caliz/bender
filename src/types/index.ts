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

export type RequestMethod =
  | 'connect'
  | 'delete'
  | 'get'
  | 'head'
  | 'options'
  | 'patch'
  | 'post'
  | 'put'
  | 'other';

export type HeaderOperation = 'set' | 'append' | 'remove';

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
  variants: string[];
  operation: HeaderOperation;
  enabled: boolean;
  comment: string;
}

export interface Scope {
  activeTabOnly: boolean;
  includeDomains: string[];
  excludeDomains: string[];
  initiatorDomains: string[];
  excludedInitiatorDomains: string[];
  urlFilter: string;
  resourceTypes: ResourceType[];
  requestMethods: RequestMethod[];
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
  | { kind: 'mock'; status: number; contentType: string; body: string; delayMs: number; headers: HeaderEntry[] }
  /**
   * Demora y/o hace fallar un porcentaje de las requests que matchean, sin inventar
   * un body. `failStatus: 0` simula un error de red; cualquier otro valor responde
   * con ese status.
   */
  | { kind: 'chaos'; delayMs: number; failRate: number; failStatus: number };

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

/**
 * Un entorno guarda que perfiles y reglas quedan prendidos, no una copia de ellos:
 * si se edita un perfil, los entornos que lo listan siguen apuntando al mismo.
 */
export interface Environment {
  id: string;
  name: string;
  profileIds: string[];
  ruleIds: string[];
}

export interface ToolkitState {
  schemaVersion: number;
  globalEnabled: boolean;
  profiles: Profile[];
  selectedProfileId: string | null;
  trafficRules: TrafficRule[];
  userScripts: UserScript[];
  environments: Environment[];
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
  activeHeaderCount: number;
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
  requestBody: string | null;
  responseBody: string | null;
  bodyTruncated: boolean;
}

export interface StoredItem {
  key: string;
  value: string;
}

export interface CookieSnapshot {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: chrome.cookies.SameSiteStatus;
  hostOnly: boolean;
  expirationDate: number | null;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}

export interface CookieSnapshotSet {
  id: string;
  name: string;
  createdAt: number;
  cookies: CookieSnapshot[];
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

export type DesignTool = 'inspect' | 'ruler' | 'spacing';

export type DesignPickKind = 'color' | 'element' | 'measure';

export interface DesignPick {
  id: string;
  kind: DesignPickKind;
  label: string;
  detail: string;
  color: string | null;
  origin: string;
  createdAt: number;
}

export type ColorRole = 'text' | 'background' | 'border';

export interface ColorUsage {
  hex: string;
  count: number;
  roles: ColorRole[];
}

export interface FontUsage {
  family: string;
  count: number;
  sizes: number[];
  weights: number[];
}

export interface ValueUsage {
  value: string;
  count: number;
}

export interface CssVariable {
  name: string;
  value: string;
}

export interface DesignAudit {
  elementCount: number;
  rootFontSize: number;
  colors: ColorUsage[];
  fonts: FontUsage[];
  spacings: ValueUsage[];
  radii: ValueUsage[];
  shadows: ValueUsage[];
  variables: CssVariable[];
}

export type DesignCommand =
  | { channel: 'bender-design'; type: 'set-tool'; tool: DesignTool }
  | { channel: 'bender-design'; type: 'close' }
  | { channel: 'bender-design'; type: 'ping' };

export interface DesignOverlayState {
  active: boolean;
  tool: DesignTool;
}

export interface BridgeHandshake {
  channel: 'bender';
  type: 'connect';
}

export interface ChaosDefinition {
  id: string;
  name: string;
  scope: Scope;
  delayMs: number;
  failRate: number;
  failStatus: number;
}

export interface PageConfig {
  mocks: MockDefinition[];
  chaos: ChaosDefinition[];
  captureBodies: boolean;
}

export interface CapturedBodies {
  url: string;
  method: string;
  requestBody: string | null;
  responseBody: string | null;
  truncated: boolean;
}

export type BridgePortMessage =
  | { type: 'page-config'; config: PageConfig }
  | { type: 'mock-hit'; url: string; method: string; ruleName: string; status: number }
  | { type: 'bodies'; bodies: CapturedBodies };
