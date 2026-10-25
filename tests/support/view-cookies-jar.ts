import type { FakeChrome } from "./fake-chrome";

export const liveCookie = (overrides: Partial<chrome.cookies.Cookie> = {}): chrome.cookies.Cookie => ({
  name: "session_id",
  value: "abc123",
  domain: "app.example.com",
  hostOnly: true,
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "lax",
  session: true,
  storeId: "0",
  ...overrides,
});

export interface CookieJar {
  cookies: Map<string, chrome.cookies.Cookie>;
}

const hostnameOf = (url: string): string => new URL(url).hostname;

export const installCookieJar = (fake: FakeChrome, initial: chrome.cookies.Cookie[]): CookieJar => {
  const cookies = new Map(initial.map((cookie) => [cookie.name, cookie]));
  fake.cookies.getAll.mockImplementation(() => Promise.resolve([...cookies.values()]));
  fake.cookies.set.mockImplementation((details) => {
    const name = details.name ?? "";
    const stored = liveCookie({
      name,
      value: details.value ?? "",
      domain: details.domain ?? hostnameOf(details.url),
      hostOnly: details.domain === undefined,
      path: details.path ?? "/",
      secure: details.secure ?? false,
      httpOnly: details.httpOnly ?? false,
      sameSite: details.sameSite ?? "unspecified",
      session: details.expirationDate === undefined,
      ...(details.expirationDate === undefined ? {} : { expirationDate: details.expirationDate }),
    });
    cookies.set(name, stored);
    return Promise.resolve(stored);
  });
  fake.cookies.remove.mockImplementation((details) => {
    cookies.delete(details.name);
    return Promise.resolve(details);
  });
  return { cookies };
};
