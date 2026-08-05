export type UserAgentPlatform = 'Android' | 'iOS' | 'macOS' | 'Windows' | 'Linux';

export interface UserAgentTraits {
  mobile: boolean;
  platform: UserAgentPlatform;
  navigatorPlatform: string;
  maxTouchPoints: number;
  chromium: boolean;
}

const TOUCH_POINTS_MOBILE = 5;
const TOUCH_POINTS_DESKTOP = 0;

const NAVIGATOR_PLATFORMS: Record<UserAgentPlatform, string> = {
  Android: 'Linux armv8l',
  iOS: 'iPhone',
  macOS: 'MacIntel',
  Windows: 'Win32',
  Linux: 'Linux x86_64',
};

const platformOf = (userAgentValue: string): UserAgentPlatform => {
  if (/Android/i.test(userAgentValue)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgentValue)) return 'iOS';
  if (/Macintosh|Mac OS X/i.test(userAgentValue)) return 'macOS';
  if (/Windows/i.test(userAgentValue)) return 'Windows';
  return 'Linux';
};

export const userAgentTraits = (userAgentValue: string): UserAgentTraits => {
  const mobile = /Mobile|Android|iPhone|iPod/i.test(userAgentValue);
  const platform = platformOf(userAgentValue);
  const navigatorPlatform = /iPad/i.test(userAgentValue) ? 'iPad' : NAVIGATOR_PLATFORMS[platform];

  return {
    mobile,
    platform,
    navigatorPlatform,
    maxTouchPoints: mobile || /iPad/i.test(userAgentValue) ? TOUCH_POINTS_MOBILE : TOUCH_POINTS_DESKTOP,
    chromium: /Chrome\/|Chromium\/|Edg\//i.test(userAgentValue),
  };
};
