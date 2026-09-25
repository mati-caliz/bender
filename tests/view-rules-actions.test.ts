import { describe, expect, it } from "vitest";
import {
  chaosPatcher,
  clamp,
  mockMutator,
  parseDecimal,
  redirectPatcher,
  type MutateBoundRule,
} from "@/ui/views/rules/rule-actions";
import type { TrafficRule } from "@/types";
import { trafficRuleWith } from "./support/dnr-fixtures";

const boundTo = (rule: TrafficRule): { mutateRule: MutateBoundRule; result: () => TrafficRule } => {
  let current = rule;
  return {
    mutateRule: (mutate) => {
      current = mutate(current);
    },
    result: () => current,
  };
};

describe("rule-actions", () => {
  it("parses base-10 integers and clamps into a range", () => {
    expect(parseDecimal("042ms")).toBe(42);
    expect(Number.isNaN(parseDecimal("ms"))).toBe(true);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("patches only rules of the matching kind", () => {
    const block = trafficRuleWith({ kind: "block" });
    const bound = boundTo(block);

    redirectPatcher(bound.mutateRule)({ target: "https://x.test" });
    chaosPatcher(bound.mutateRule)({ delayMs: 10 });
    mockMutator(bound.mutateRule)((action) => ({ ...action, status: 404 }));

    expect(bound.result()).toBe(block);
  });

  it("patches redirect, chaos and mock actions", () => {
    const redirect = boundTo(trafficRuleWith({ kind: "redirect", target: "", useRegex: false }));
    const chaos = boundTo(trafficRuleWith({ kind: "chaos", delayMs: 0, failRate: 0, failStatus: 500 }));
    const mock = boundTo(
      trafficRuleWith({ kind: "mock", status: 200, contentType: "", body: "", delayMs: 0, headers: [] }),
    );

    redirectPatcher(redirect.mutateRule)({ target: "https://x.test" });
    chaosPatcher(chaos.mutateRule)({ delayMs: 10 });
    mockMutator(mock.mutateRule)((action) => ({ ...action, status: 404 }));

    expect(redirect.result().action).toEqual({ kind: "redirect", target: "https://x.test", useRegex: false });
    expect(chaos.result().action).toMatchObject({ kind: "chaos", delayMs: 10 });
    expect(mock.result().action).toMatchObject({ kind: "mock", status: 404 });
  });
});
