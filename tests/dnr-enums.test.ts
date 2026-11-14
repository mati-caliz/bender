import { describe, expect, it } from "vitest";

import { createEnumNarrower, toDnrHeaderOperation } from "@/lib/dnr-enums";

describe("declarativeNetRequest enums", () => {
  it("narrows a known value and rejects an unknown one", () => {
    const colors = createEnumNarrower<"red" | "green">({ red: true, green: true });

    expect(colors.isMember("red")).toBe(true);
    expect(colors.narrow("green")).toBe("green");
    expect(() => colors.narrow("blue")).toThrow("Valor desconocido para declarativeNetRequest: blue");
  });

  it("maps a header operation to its declarativeNetRequest value", () => {
    expect(toDnrHeaderOperation("remove")).toBe("remove");
  });
});
