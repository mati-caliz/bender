import { sanitizeDomainList } from '@/lib/scope';
import { userAgentTraits } from '@/lib/user-agent-traits';
import type { EngineDiagnostic, ToolkitState, UserAgentConfig } from '@/types';

export const NAVIGATOR_SPOOF_SCRIPT_ID = 'bender-navigator-spoof';

const ALL_URLS_MATCH = '*://*/*';

export interface NavigatorSpoofRegistration {
  id: string;
  matches: string[];
  excludeMatches: string[];
  code: string;
}

const domainToMatch = (domain: string): string => `*://*.${domain}/*`;

export const navigatorSpoofMatches = (scope: UserAgentConfig['scope']): string[] => {
  const includeDomains = sanitizeDomainList(scope.includeDomains);
  return includeDomains.length ? includeDomains.map(domainToMatch) : [ALL_URLS_MATCH];
};

export const navigatorSpoofExcludeMatches = (scope: UserAgentConfig['scope']): string[] =>
  sanitizeDomainList(scope.excludeDomains).map(domainToMatch);

export const buildNavigatorSpoofCode = (userAgentValue: string): string => {
  const { mobile, platform, navigatorPlatform, maxTouchPoints, chromium } = userAgentTraits(userAgentValue);
  const brands = chromium ? 'navigator.userAgentData?.brands ?? []' : '[]';

  return `(() => {
  const userAgent = ${JSON.stringify(userAgentValue)};
  const platform = ${JSON.stringify(navigatorPlatform)};
  const mobile = ${String(mobile)};
  const maxTouchPoints = ${String(maxTouchPoints)};
  const appVersion = userAgent.replace(/^Mozilla\\//, '');

  const define = (target, property, value) => {
    try {
      Object.defineProperty(target, property, { configurable: true, enumerable: true, get: () => value });
    } catch {}
  };

  define(navigator, 'userAgent', userAgent);
  define(navigator, 'appVersion', appVersion);
  define(navigator, 'platform', platform);
  define(navigator, 'maxTouchPoints', maxTouchPoints);

  if (navigator.userAgentData) {
    const brands = ${brands};
    define(navigator, 'userAgentData', {
      brands,
      mobile,
      platform: ${JSON.stringify(platform)},
      toJSON: () => ({ brands, mobile, platform: ${JSON.stringify(platform)} }),
      getHighEntropyValues: (hints) =>
        Promise.resolve(
          Object.fromEntries(
            hints.map((hint) => {
              if (hint === 'platform') return [hint, ${JSON.stringify(platform)}];
              if (hint === 'mobile') return [hint, mobile];
              if (hint === 'brands' || hint === 'fullVersionList') return [hint, brands];
              return [hint, ''];
            })
          )
        ),
    });
  }
})();
`;
};

export const navigatorSpoofRegistration = (state: ToolkitState): NavigatorSpoofRegistration | null => {
  const { enabled, spoofNavigator, value, scope } = state.userAgent;
  if (!state.globalEnabled || !enabled || !spoofNavigator) return null;

  const userAgentValue = value.trim();
  if (!userAgentValue) return null;

  return {
    id: NAVIGATOR_SPOOF_SCRIPT_ID,
    matches: navigatorSpoofMatches(scope),
    excludeMatches: navigatorSpoofExcludeMatches(scope),
    code: buildNavigatorSpoofCode(userAgentValue),
  };
};

export const navigatorSpoofDiagnostics = (userAgent: UserAgentConfig): EngineDiagnostic[] => {
  const { enabled, spoofNavigator, scope } = userAgent;
  if (!enabled || !spoofNavigator) return [];

  const diagnostics: EngineDiagnostic[] = [];

  if (scope.activeTabOnly) {
    diagnostics.push({
      level: 'warning',
      message:
        'navigator: el spoof se registra por dominio, asi que ignora "solo la pestaña activa" y aplica a todo el alcance.',
    });
  }

  if (scope.urlFilter.trim()) {
    diagnostics.push({
      level: 'warning',
      message: 'navigator: el spoof no filtra por URL, aplica a todo el dominio del alcance.',
    });
  }

  return diagnostics;
};
