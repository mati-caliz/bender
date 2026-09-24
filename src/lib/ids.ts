const RANDOM_ID_BYTES = 16;
const HEX_RADIX = 16;

export const createId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(RANDOM_ID_BYTES)), (byte) =>
        byte.toString(HEX_RADIX).padStart(2, "0"),
      ).join("");
