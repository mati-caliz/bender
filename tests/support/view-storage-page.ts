import type { FakeChrome } from "./fake-chrome";

interface PageFunctionInjection {
  func: (...args: unknown[]) => unknown;
  args: unknown[];
}

const isPageFunctionInjection = (injection: unknown): injection is PageFunctionInjection =>
  typeof injection === "object" &&
  injection !== null &&
  "func" in injection &&
  typeof injection.func === "function" &&
  "args" in injection &&
  Array.isArray(injection.args);

export const runInjectionsAgainstThisPage = (fake: FakeChrome): void => {
  fake.scripting.executeScript.mockImplementation((injection) => {
    if (!isPageFunctionInjection(injection)) return Promise.reject(new Error("Inyeccion sin func"));
    return Promise.resolve([{ result: injection.func(...injection.args) }]);
  });
};
