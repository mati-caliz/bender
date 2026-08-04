import { PROFILE_COLORS, createEmptyScope } from '@/lib/constants';
import { createId } from '@/lib/ids';
import type { HeaderEntry, Profile, TrafficRule, TrafficRuleAction, UserScript, UserScriptLanguage } from '@/types';

const DEFAULT_MOCK_STATUS = 200;
const DEFAULT_MOCK_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_MOCK_BODY = '{\n  "ok": true\n}';

export const createHeaderEntry = (overrides: Partial<HeaderEntry> = {}): HeaderEntry => ({
  id: createId(),
  name: '',
  value: '',
  operation: 'set',
  enabled: true,
  comment: '',
  ...overrides,
});

export const createProfile = (existingCount: number, overrides: Partial<Profile> = {}): Profile => ({
  id: createId(),
  name: `Perfil ${existingCount + 1}`,
  color: PROFILE_COLORS[existingCount % PROFILE_COLORS.length] ?? PROFILE_COLORS[0] ?? '#6366f1',
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [createHeaderEntry()],
  responseHeaders: [],
  ...overrides,
});

export const createTrafficRuleAction = (kind: TrafficRuleAction['kind']): TrafficRuleAction => {
  switch (kind) {
    case 'block':
      return { kind: 'block' };
    case 'redirect':
      return { kind: 'redirect', target: '', useRegex: false };
    case 'mock':
      return {
        kind: 'mock',
        status: DEFAULT_MOCK_STATUS,
        contentType: DEFAULT_MOCK_CONTENT_TYPE,
        body: DEFAULT_MOCK_BODY,
        delayMs: 0,
        headers: [],
      };
  }
};

export const createTrafficRule = (kind: TrafficRuleAction['kind'], existingCount: number): TrafficRule => ({
  id: createId(),
  name: `Regla ${existingCount + 1}`,
  enabled: true,
  scope: createEmptyScope(),
  action: createTrafficRuleAction(kind),
});

export const createUserScript = (
  language: UserScriptLanguage,
  existingCount: number,
  overrides: Partial<UserScript> = {}
): UserScript => ({
  id: createId(),
  name: language === 'css' ? `Estilo ${existingCount + 1}` : `Script ${existingCount + 1}`,
  description: '',
  enabled: true,
  language,
  matches: [],
  excludeMatches: [],
  runAt: 'document_idle',
  world: 'MAIN',
  allFrames: false,
  code: '',
  updatedAt: Date.now(),
  ...overrides,
});
