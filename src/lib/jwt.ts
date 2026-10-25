import { hasText } from "@/lib/text";

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const MILLISECONDS_PER_SECOND = 1000;
const BASE64_BLOCK_LENGTH = 4;
const HEX_RADIX = 16;

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  issuedAt: Date | null;
  expiresAt: Date | null;
  expired: boolean;
}

export const looksLikeJwt = (value: string): boolean => JWT_PATTERN.test(value.trim());

const paddingNeeded = (length: number): number =>
  (BASE64_BLOCK_LENGTH - (length % BASE64_BLOCK_LENGTH)) % BASE64_BLOCK_LENGTH;

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const decodeSegment = (segment: string): Record<string, unknown> => {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(padded.padEnd(padded.length + paddingNeeded(padded.length), "="))
      .split("")
      .map((character) => `%${character.charCodeAt(0).toString(HEX_RADIX).padStart(2, "0")}`)
      .join(""),
  );
  const parsed: unknown = JSON.parse(json);
  return isObjectLike(parsed) ? parsed : {};
};

const readTimestamp = (payload: Record<string, unknown>, claim: string): Date | null => {
  const value = payload[claim];
  return typeof value === "number" ? new Date(value * MILLISECONDS_PER_SECOND) : null;
};

export const decodeJwt = (value: string): DecodedJwt | null => {
  const trimmed = value.trim();
  if (!looksLikeJwt(trimmed)) return null;

  const [headerSegment, payloadSegment] = trimmed.split(".");
  if (!hasText(headerSegment) || !hasText(payloadSegment)) return null;

  try {
    const payload = decodeSegment(payloadSegment);
    const expiresAt = readTimestamp(payload, "exp");
    return {
      header: decodeSegment(headerSegment),
      payload,
      issuedAt: readTimestamp(payload, "iat"),
      expiresAt,
      expired: expiresAt !== null && expiresAt.getTime() < Date.now(),
    };
  } catch {
    return null;
  }
};
