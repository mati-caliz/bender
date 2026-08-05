import type { NetworkEntry } from '@/types';

const HAR_VERSION = '1.2';
const HTTP_VERSION = 'HTTP/1.1';
const UNKNOWN_SIZE = -1;
const CONTENT_TYPE_HEADER = 'content-type';

interface HarNameValue {
  name: string;
  value: string;
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: HarNameValue[];
    queryString: HarNameValue[];
    cookies: HarNameValue[];
    headersSize: number;
    bodySize: number;
    postData?: { mimeType: string; text: string };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: HarNameValue[];
    cookies: HarNameValue[];
    content: { size: number; mimeType: string; text?: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, never>;
  timings: { send: number; wait: number; receive: number };
  comment?: string;
}

export interface Har {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

const queryStringOf = (url: string): HarNameValue[] => {
  try {
    return Array.from(new URL(url).searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
};

const headerValue = (headers: HarNameValue[], name: string): string =>
  headers.find((header) => header.name.toLowerCase() === name)?.value ?? '';

const toHarEntry = (entry: NetworkEntry): HarEntry => {
  const time = entry.finishedAt === null ? 0 : Math.max(0, entry.finishedAt - entry.startedAt);
  const responseMimeType = headerValue(entry.responseHeaders, CONTENT_TYPE_HEADER);

  const harEntry: HarEntry = {
    startedDateTime: new Date(entry.startedAt).toISOString(),
    time,
    request: {
      method: entry.method,
      url: entry.url,
      httpVersion: HTTP_VERSION,
      headers: entry.requestHeaders,
      queryString: queryStringOf(entry.url),
      cookies: [],
      headersSize: UNKNOWN_SIZE,
      bodySize: entry.requestBody === null ? UNKNOWN_SIZE : entry.requestBody.length,
    },
    response: {
      status: entry.statusCode ?? 0,
      statusText: entry.statusLine,
      httpVersion: HTTP_VERSION,
      headers: entry.responseHeaders,
      cookies: [],
      content: {
        size: entry.responseBody === null ? 0 : entry.responseBody.length,
        mimeType: responseMimeType,
        ...(entry.responseBody === null ? {} : { text: entry.responseBody }),
      },
      redirectURL: '',
      headersSize: UNKNOWN_SIZE,
      bodySize: entry.responseBody === null ? UNKNOWN_SIZE : entry.responseBody.length,
    },
    cache: {},
    timings: { send: 0, wait: time, receive: 0 },
  };

  if (entry.requestBody !== null) {
    harEntry.request.postData = {
      mimeType: headerValue(entry.requestHeaders, CONTENT_TYPE_HEADER),
      text: entry.requestBody,
    };
  }

  const notes = [
    ...entry.matchedRuleLabels,
    ...(entry.bodyTruncated ? ['cuerpo truncado por Bender'] : []),
    ...(entry.error ? [entry.error] : []),
  ];
  if (notes.length) harEntry.comment = notes.join(' · ');

  return harEntry;
};

export const toHar = (entries: NetworkEntry[], creatorVersion: string): Har => ({
  log: {
    version: HAR_VERSION,
    creator: { name: 'Bender', version: creatorVersion },
    entries: [...entries].sort((first, second) => first.startedAt - second.startedAt).map(toHarEntry),
  },
});
