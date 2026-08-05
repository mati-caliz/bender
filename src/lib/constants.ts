import type {
  CorsConfig,
  NetworkConfig,
  RequestMethod,
  ResourceType,
  Scope,
  ToolkitState,
  UiConfig,
  UserAgentConfig,
} from '@/types';

export const STORAGE_KEY = 'benderState';
export const ENGINE_STATUS_KEY = 'benderEngineStatus';
export const NETWORK_LOG_KEY = 'benderNetworkLog';
export const DISABLED_COOKIES_KEY = 'benderDisabledCookies';
export const DISABLED_STORAGE_KEY = 'benderDisabledStorage';
export const COOKIE_SNAPSHOTS_KEY = 'benderCookieSnapshots';
export const DESIGN_PICKS_KEY = 'benderDesignPicks';

export const SCHEMA_VERSION = 1;

export const ALL_RESOURCE_TYPES: ResourceType[] = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'other',
];

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  main_frame: 'Documento',
  sub_frame: 'iframe',
  stylesheet: 'CSS',
  script: 'JS',
  image: 'Imagen',
  font: 'Fuente',
  object: 'Object',
  xmlhttprequest: 'XHR / fetch',
  ping: 'Ping',
  csp_report: 'CSP report',
  media: 'Media',
  websocket: 'WebSocket',
  other: 'Otro',
};

export const ALL_REQUEST_METHODS: RequestMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'connect',
  'other',
];

export const REQUEST_METHOD_LABELS: Record<RequestMethod, string> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
  connect: 'CONNECT',
  other: 'Otro',
};

export const HTTP_TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export const PROFILE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#64748b',
];

export const ACCENT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export interface UserAgentPreset {
  id: string;
  label: string;
  group: string;
  value: string;
}

export const USER_AGENT_PRESETS: UserAgentPreset[] = [
  {
    id: 'iphone-safari',
    label: 'iPhone · Safari iOS 17',
    group: 'Mobile',
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'android-chrome',
    label: 'Android · Chrome 126',
    group: 'Mobile',
    value:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  },
  {
    id: 'ipad-safari',
    label: 'iPad · Safari iPadOS 17',
    group: 'Tablet',
    value:
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'mac-safari',
    label: 'macOS · Safari 17',
    group: 'Desktop',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  },
  {
    id: 'windows-firefox',
    label: 'Windows · Firefox 128',
    group: 'Desktop',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  },
  {
    id: 'windows-edge',
    label: 'Windows · Edge 126',
    group: 'Desktop',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  },
  {
    id: 'googlebot',
    label: 'Googlebot',
    group: 'Bots',
    value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
  {
    id: 'bingbot',
    label: 'Bingbot',
    group: 'Bots',
    value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  },
  {
    id: 'curl',
    label: 'curl 8',
    group: 'Herramientas',
    value: 'curl/8.7.1',
  },
];

export const CUSTOM_USER_AGENT_PRESET_ID = 'custom';

export const CONTENT_TYPE_PRESETS = [
  'application/json; charset=utf-8',
  'text/plain; charset=utf-8',
  'text/html; charset=utf-8',
  'application/xml',
  'application/javascript',
];

export const createEmptyScope = (): Scope => ({
  activeTabOnly: false,
  includeDomains: [],
  excludeDomains: [],
  initiatorDomains: [],
  excludedInitiatorDomains: [],
  urlFilter: '',
  resourceTypes: [],
  requestMethods: [],
});

export const DEFAULT_CORS_CONFIG: CorsConfig = {
  enabled: false,
  allowOrigin: 'reflect',
  customOrigin: '',
  allowCredentials: true,
  allowMethods: 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  allowHeaders: '*',
  exposeHeaders: '*',
  maxAgeSeconds: 600,
  removeContentSecurityPolicy: false,
  removeFrameOptions: false,
  scope: createEmptyScope(),
};

export const DEFAULT_USER_AGENT_CONFIG: UserAgentConfig = {
  enabled: false,
  presetId: 'iphone-safari',
  value: USER_AGENT_PRESETS[0]?.value ?? '',
  spoofClientHints: true,
  spoofNavigator: false,
  scope: createEmptyScope(),
};

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  enabled: false,
  maxEntries: 500,
  captureBodies: false,
  onlyModified: false,
};

export const DEFAULT_UI_CONFIG: UiConfig = {
  theme: 'system',
  accent: '#6366f1',
  lastView: 'overview',
  density: 'comfortable',
};

export const createDefaultState = (): ToolkitState => ({
  schemaVersion: SCHEMA_VERSION,
  globalEnabled: true,
  profiles: [],
  selectedProfileId: null,
  trafficRules: [],
  userScripts: [],
  environments: [],
  cors: DEFAULT_CORS_CONFIG,
  userAgent: DEFAULT_USER_AGENT_CONFIG,
  network: DEFAULT_NETWORK_CONFIG,
  ui: DEFAULT_UI_CONFIG,
});
