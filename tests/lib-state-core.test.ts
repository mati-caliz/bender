import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CORS_CONFIG,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_UI_CONFIG,
  SCHEMA_VERSION,
  createEmptyScope,
} from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { sendMessage } from "@/lib/messages";
import { migrateStoredState } from "@/lib/migrations";
import { normalizeState, normalizeStateDetailed } from "@/lib/state";
import { installFakeChrome } from "./support/fake-chrome";

const storedProfile = (id: string) => ({
  id,
  name: id,
  color: "#6366f1",
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("migrateStoredState", () => {
  it("stamps the current schema version when none was stored", () => {
    expect(migrateStoredState({ profiles: [] })).toEqual({ profiles: [], schemaVersion: SCHEMA_VERSION });
  });

  it("keeps the stored version when it is already current", () => {
    expect(migrateStoredState({ schemaVersion: SCHEMA_VERSION })).toEqual({ schemaVersion: SCHEMA_VERSION });
  });

  it("stops at an older version that has no registered migration", () => {
    const olderVersion = SCHEMA_VERSION - 1;

    expect(migrateStoredState({ schemaVersion: olderVersion, globalEnabled: false })).toEqual({
      schemaVersion: olderVersion,
      globalEnabled: false,
    });
  });

  it("ignores a schema version that is not a number", () => {
    expect(migrateStoredState({ schemaVersion: "2" })).toEqual({ schemaVersion: SCHEMA_VERSION });
  });
});

describe("normalizeStateDetailed top level fields", () => {
  it("keeps a stored globalEnabled flag", () => {
    expect(normalizeStateDetailed({ globalEnabled: false }).state.globalEnabled).toBe(false);
  });

  it("falls back to enabled when globalEnabled is not a boolean", () => {
    expect(normalizeStateDetailed({ globalEnabled: "no" }).state.globalEnabled).toBe(true);
  });

  it("keeps the stored schema version", () => {
    expect(normalizeStateDetailed({ schemaVersion: SCHEMA_VERSION }).state.schemaVersion).toBe(
      SCHEMA_VERSION,
    );
  });

  it("keeps the selected profile when it still exists", () => {
    const { state } = normalizeStateDetailed({
      profiles: [storedProfile("profile-1"), storedProfile("profile-2")],
      selectedProfileId: "profile-2",
    });

    expect(state.selectedProfileId).toBe("profile-2");
  });

  it("drops a selected profile id that is not a string", () => {
    const { state } = normalizeStateDetailed({
      profiles: [storedProfile("profile-1")],
      selectedProfileId: 1,
    });

    expect(state.selectedProfileId).toBeNull();
  });

  it("merges stored sections over the defaults and ignores broken ones", () => {
    const { state } = normalizeStateDetailed({
      cors: { enabled: true },
      network: "roto",
      ui: { theme: "dark" },
    });

    expect(state.cors).toEqual({ ...DEFAULT_CORS_CONFIG, enabled: true });
    expect(state.network).toEqual(DEFAULT_NETWORK_CONFIG);
    expect(state.ui).toEqual({ ...DEFAULT_UI_CONFIG, theme: "dark" });
  });

  it("counts dropped rules, scripts and environments separately", () => {
    const { state, dropped } = normalizeStateDetailed({
      trafficRules: [{ id: "rule-1", action: { kind: "block" } }, { id: "rule-2" }],
      userScripts: [{ id: "script-1" }, "roto", 4],
      environments: [{ name: "Staging" }, { name: "" }],
    });

    expect(state.trafficRules).toHaveLength(1);
    expect(state.userScripts).toHaveLength(1);
    expect(state.environments).toHaveLength(1);
    expect(dropped).toEqual({ profiles: 0, trafficRules: 1, userScripts: 2, environments: 1 });
  });

  it("normalizeState returns only the state", () => {
    expect(normalizeState(null)).toEqual(normalizeStateDetailed(null).state);
  });
});

describe("createId", () => {
  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    expect(createId()).toBe("fixed-uuid");
  });

  it("falls back to 32 hex characters without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        array.fill(10);
        return array;
      },
    });

    expect(createId()).toBe("0a".repeat(16));
  });
});

describe("errorMessage", () => {
  it("uses the message of an Error", () => {
    expect(errorMessage(new TypeError("fallo"), "otro")).toBe("fallo");
  });

  it("uses the fallback for anything else", () => {
    expect(errorMessage("fallo", "No se pudo")).toBe("No se pudo");
    expect(errorMessage(undefined, "No se pudo")).toBe("No se pudo");
  });
});

describe("sendMessage", () => {
  it("forwards the message to the runtime and returns its answer", async () => {
    const fake = installFakeChrome();
    fake.runtime.sendMessage.mockResolvedValue([]);

    await expect(sendMessage({ type: "network/list" })).resolves.toEqual([]);
    expect(fake.runtime.sendMessage).toHaveBeenCalledWith({ type: "network/list" });
  });

  it("propagates a runtime rejection", async () => {
    const fake = installFakeChrome();
    fake.runtime.sendMessage.mockRejectedValue(new Error("Receiving end does not exist."));

    await expect(sendMessage({ type: "engine/status" })).rejects.toThrow("Receiving end does not exist.");
  });
});
