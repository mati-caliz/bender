import { beforeEach, describe, expect, it } from "vitest";
import {
  cookieKeyOf,
  fetchLiveCookies,
  removeCookies,
  toRemoveDetails,
  toSetDetails,
  toSnapshot,
} from "@/ui/hooks/cookie-details";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { liveCookieWith, snapshotWith } from "./support/ui-hook-fixtures";

const PARTITION = { topLevelSite: "https://top.local" };

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
});

describe("cookieKeyOf", () => {
  it("joins name, domain and path so homonymous cookies stay distinct", () => {
    expect(cookieKeyOf(snapshotWith())).toBe("sid\tapp.local\t/");
    expect(cookieKeyOf(snapshotWith({ path: "/api" }))).not.toBe(cookieKeyOf(snapshotWith()));
  });
});

describe("toSnapshot", () => {
  it("keeps the editable fields and turns a missing expiration into null", () => {
    const snapshot = toSnapshot(liveCookieWith({ expirationDate: undefined }));

    expect(snapshot).toEqual(snapshotWith());
    expect("partitionKey" in snapshot).toBe(false);
  });

  it("carries the partition key when the cookie is partitioned", () => {
    const snapshot = toSnapshot(liveCookieWith({ expirationDate: 123, partitionKey: PARTITION }));

    expect(snapshot.expirationDate).toBe(123);
    expect(snapshot.partitionKey).toEqual(PARTITION);
  });
});

describe("toSetDetails", () => {
  it("builds an https url for secure host-only cookies without domain or expiration", () => {
    const details = toSetDetails(snapshotWith({ path: "/api" }), "fallback.local");

    expect(details).toEqual({
      url: "https://app.local/api",
      name: "sid",
      value: "abc",
      path: "/api",
      secure: true,
      httpOnly: false,
      sameSite: "lax",
    });
  });

  it("uses the fallback domain and default path and keeps domain, expiration and partition", () => {
    const details = toSetDetails(
      snapshotWith({
        domain: "",
        path: "",
        secure: false,
        hostOnly: false,
        expirationDate: 1_900_000_000,
        partitionKey: PARTITION,
      }),
      "fallback.local",
    );

    expect(new URL(details.url).protocol).toBe("http:");
    expect(new URL(details.url).host).toBe("fallback.local");
    expect(details.path).toBe("/");
    expect(details.domain).toBeUndefined();
    expect(details.expirationDate).toBe(1_900_000_000);
    expect(details.partitionKey).toEqual(PARTITION);
  });

  it("strips the leading dot of a domain cookie for the url but keeps it as domain", () => {
    const details = toSetDetails(snapshotWith({ domain: ".app.local", hostOnly: false }), "fallback.local");

    expect(details.url).toBe("https://app.local/");
    expect(details.domain).toBe(".app.local");
  });

  it("ignores zero and NaN expirations so the cookie stays a session cookie", () => {
    expect(toSetDetails(snapshotWith({ expirationDate: 0 }), "app.local").expirationDate).toBeUndefined();
    expect(
      toSetDetails(snapshotWith({ expirationDate: Number.NaN }), "app.local").expirationDate,
    ).toBeUndefined();
  });
});

describe("toRemoveDetails", () => {
  it("targets the cookie url and name and adds the partition only when present", () => {
    expect(toRemoveDetails(snapshotWith(), "app.local")).toEqual({ url: "https://app.local/", name: "sid" });
    expect(toRemoveDetails(snapshotWith({ partitionKey: PARTITION }), "app.local").partitionKey).toEqual(
      PARTITION,
    );
  });
});

describe("chrome.cookies helpers", () => {
  it("removes every cookie passed in", async () => {
    await removeCookies([snapshotWith(), snapshotWith({ name: "theme" })], "app.local");

    expect(fake.cookies.remove).toHaveBeenCalledTimes(2);
    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: "https://app.local/", name: "theme" });
  });

  it("reads partitioned cookies and maps them to snapshots", async () => {
    fake.cookies.getAll.mockResolvedValue([liveCookieWith()]);

    const cookies = await fetchLiveCookies("https://app.local/home");

    expect(fake.cookies.getAll).toHaveBeenCalledWith({ url: "https://app.local/home", partitionKey: {} });
    expect(cookies).toEqual([snapshotWith({ expirationDate: 2_000_000_000 })]);
  });

  it("falls back to an unpartitioned query when the browser rejects partitionKey", async () => {
    fake.cookies.getAll
      .mockRejectedValueOnce(new Error("partitionKey no soportado"))
      .mockResolvedValueOnce([liveCookieWith({ name: "legacy" })]);

    const cookies = await fetchLiveCookies("https://app.local/home");

    expect(fake.cookies.getAll).toHaveBeenLastCalledWith({ url: "https://app.local/home" });
    expect(cookies.map((cookie) => cookie.name)).toEqual(["legacy"]);
  });
});
