const BYTES_PER_UNIT = 1024;
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];
const MILLISECONDS_PER_SECOND = 1000;

export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTES_PER_UNIT && unitIndex < SIZE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unitIndex += 1;
  }
  return `${value < 10 && unitIndex > 0 ? value.toFixed(1) : Math.round(value)} ${SIZE_UNITS[unitIndex]}`;
};

export const formatDuration = (milliseconds: number): string =>
  milliseconds < MILLISECONDS_PER_SECOND
    ? `${Math.round(milliseconds)} ms`
    : `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(2)} s`;

export const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('es-AR', { hour12: false });

export const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString('es-AR', { hour12: false });

export const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

export const shortUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || parsed.hostname;
  } catch {
    return url;
  }
};

export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

export const prettyJson = (value: string): string => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};
