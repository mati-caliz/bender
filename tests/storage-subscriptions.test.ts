import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESIGN_PICKS_KEY, STORAGE_KEY, createDefaultState } from "@/lib/constants";
import {
  MAX_DESIGN_PICKS,
  appendDesignPick,
  readDesignPicks,
  subscribeToDesignPicks,
  writeDesignPicks,
} from "@/lib/design-picks";
import { readState, readStateDetailed, subscribeToState, updateState, writeState } from "@/lib/state";
import type { DesignPick } from "@/types";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";

let fakeChrome: FakeChrome;

const pick = (label: string): DesignPick => ({
  id: label,
  kind: "color",
  label,
  detail: "",
  color: label,
  origin: "https://app.local",
  createdAt: 1,
});

beforeEach(() => {
  fakeChrome = installFakeChrome();
});

describe("design picks storage", () => {
  it("returns an empty list when nothing valid is stored", async () => {
    expect(await readDesignPicks()).toEqual([]);

    await fakeChrome.storage.local.set({ [DESIGN_PICKS_KEY]: "corrupted" });

    expect(await readDesignPicks()).toEqual([]);
  });

  it("prepends new picks and caps the stored list", async () => {
    const existing = Array.from({ length: MAX_DESIGN_PICKS }, (_, index) => pick(`#00000${index}`));
    await writeDesignPicks(existing);

    await appendDesignPick(pick("#ffffff"));
    const stored = await readDesignPicks();

    expect(stored).toHaveLength(MAX_DESIGN_PICKS);
    expect(stored[0]?.label).toBe("#ffffff");
    expect(stored.at(-1)?.label).toBe(existing.at(-2)?.label);
  });

  it("notifies local changes to its key until unsubscribed", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDesignPicks(listener);

    await fakeChrome.storage.session.set({ [DESIGN_PICKS_KEY]: [pick("#111111")] });
    await fakeChrome.storage.local.set({ unrelated: true });
    expect(listener).not.toHaveBeenCalled();

    await writeDesignPicks([pick("#222222")]);
    expect(listener).toHaveBeenCalledWith([pick("#222222")]);

    unsubscribe();
    await writeDesignPicks([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("toolkit state storage", () => {
  it("reads defaults when storage is empty", async () => {
    const { state, dropped } = await readStateDetailed();

    expect(state).toEqual(createDefaultState());
    expect(dropped).toEqual({ profiles: 0, trafficRules: 0, userScripts: 0, environments: 0 });
  });

  it("persists a written state and applies updates on top of it", async () => {
    await writeState({ ...createDefaultState(), globalEnabled: false });

    const updated = await updateState((current) => ({ ...current, ui: { ...current.ui, lastView: "cors" } }));

    expect(updated.globalEnabled).toBe(false);
    expect((await readState()).ui.lastView).toBe("cors");
  });

  it("delivers normalized local changes and ignores other areas", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToState(listener);

    await fakeChrome.storage.session.set({ [STORAGE_KEY]: { globalEnabled: false } });
    expect(listener).not.toHaveBeenCalled();

    await fakeChrome.storage.local.set({ [STORAGE_KEY]: { globalEnabled: false, profiles: ["broken"] } });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ globalEnabled: false, profiles: [] }));

    unsubscribe();
    expect(fakeChrome.storage.onChanged.listenerCount()).toBe(0);
  });
});
