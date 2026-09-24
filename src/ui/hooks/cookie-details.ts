import type { CookieSnapshot } from "@/types";

const DEFAULT_COOKIE_PATH = "/";
const LEADING_DOT_PATTERN = /^\./;

export const cookieKeyOf = (cookie: CookieSnapshot): string =>
  `${cookie.name}\t${cookie.domain}\t${cookie.path}`;

export const toSnapshot = (cookie: chrome.cookies.Cookie): CookieSnapshot => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
  sameSite: cookie.sameSite,
  hostOnly: cookie.hostOnly,
  expirationDate: cookie.expirationDate ?? null,
  ...(cookie.partitionKey === undefined ? {} : { partitionKey: cookie.partitionKey }),
});

const cookieUrl = (cookie: CookieSnapshot, fallbackDomain: string): string => {
  const domain = (cookie.domain || fallbackDomain).replace(LEADING_DOT_PATTERN, "");
  return `${cookie.secure ? "https" : "http"}://${domain}${cookie.path || DEFAULT_COOKIE_PATH}`;
};

const hasExpirationDate = (expirationDate: number | null): expirationDate is number =>
  expirationDate !== null && expirationDate !== 0 && !Number.isNaN(expirationDate);

export const toSetDetails = (cookie: CookieSnapshot, fallbackDomain: string): chrome.cookies.SetDetails => {
  const details: chrome.cookies.SetDetails = {
    url: cookieUrl(cookie, fallbackDomain),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path || DEFAULT_COOKIE_PATH,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
  };
  if (!cookie.hostOnly && cookie.domain) details.domain = cookie.domain;
  if (hasExpirationDate(cookie.expirationDate)) details.expirationDate = cookie.expirationDate;
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return details;
};

export const toRemoveDetails = (
  cookie: CookieSnapshot,
  fallbackDomain: string,
): chrome.cookies.CookieDetails => {
  const details: chrome.cookies.CookieDetails = { url: cookieUrl(cookie, fallbackDomain), name: cookie.name };
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return details;
};

export const removeCookies = async (cookies: CookieSnapshot[], fallbackDomain: string): Promise<void> => {
  await Promise.all(cookies.map((cookie) => chrome.cookies.remove(toRemoveDetails(cookie, fallbackDomain))));
};

export const fetchLiveCookies = async (url: string): Promise<CookieSnapshot[]> => {
  const cookies = await chrome.cookies
    .getAll({ url, partitionKey: {} })
    .catch(async () => await chrome.cookies.getAll({ url }));
  return cookies.map(toSnapshot);
};
