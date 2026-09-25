// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_URL,
  capturedBodies,
  chaosRule,
  flush,
  loadInject,
  mockRule,
  runXhr,
} from "./support/content-inject";

const MAX_BODY_CHARS = 20000;

afterEach(() => {
  vi.useRealTimers();
});

describe("inject: page config", () => {
  it("ignores port messages that are not a config and tolerates malformed lists", async () => {
    const { port, realFetch } = await loadInject({ mocks: [mockRule()] });

    port.postMessage({ type: "mock-hit" });
    port.postMessage({ type: "page-config", config: { mocks: "nada", chaos: 3, captureBodies: false } });
    await flush();
    await window.fetch(API_URL);

    expect(realFetch).toHaveBeenCalledOnce();
  });

  it("stops waiting for the config after the timeout and lets requests through", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { realFetch } = await loadInject({}, { sendConfig: false });

    const pending = window.fetch(API_URL);
    await vi.advanceTimersByTimeAsync(2000);
    await pending;

    expect(realFetch).toHaveBeenCalledOnce();
  });
});

describe("inject: fetch inputs", () => {
  it("resolves relative urls, URL objects and Request objects", async () => {
    const { messages } = await loadInject({ mocks: [mockRule({ name: "Todo" })] });

    const relative = await window.fetch("/api/users");
    const fromUrl = await window.fetch(new URL(API_URL));
    const fromRequest = await window.fetch(new Request(API_URL, { method: "delete" }));
    await flush();

    expect(relative.url).toBe(new URL("/api/users", document.baseURI).href);
    expect(fromUrl.url).toBe(API_URL);
    expect(fromRequest.url).toBe(API_URL);
    expect(messages).toContainEqual(expect.objectContaining({ type: "mock-hit", method: "DELETE" }));
  });

  it("keeps an unparseable url as written", async () => {
    const { realFetch } = await loadInject();

    await window.fetch("https://[invalida");

    expect(realFetch).toHaveBeenCalledWith("https://[invalida", undefined);
  });

  it("uses the init method, falling back to GET when it is empty", async () => {
    const { messages } = await loadInject({ mocks: [mockRule()] });

    await window.fetch(API_URL, { method: "patch" });
    await window.fetch(API_URL, { method: "" });
    await flush();

    expect(messages.filter((message) => JSON.stringify(message).includes('"method":"PATCH"'))).toHaveLength(
      1,
    );
    expect(messages.filter((message) => JSON.stringify(message).includes('"method":"GET"'))).toHaveLength(1);
  });

  it("serves a delayed mock without content type", async () => {
    await loadInject({ mocks: [mockRule({ contentType: "", delayMs: 5, body: "plano" })] });

    const response = await window.fetch(API_URL);

    expect(response.headers.get("content-type")).toBe("text/plain;charset=UTF-8");
    expect(await response.text()).toBe("plano");
  });
});

describe("inject: fetch body capture", () => {
  it("reports request and response bodies when capture is on", async () => {
    const { messages } = await loadInject({ captureBodies: true });

    await window.fetch(API_URL, { method: "post", body: "hola" });
    await vi.waitFor(() => {
      expect(capturedBodies(messages)).toEqual([
        { url: API_URL, method: "POST", requestBody: "hola", responseBody: "real", truncated: false },
      ]);
    });
  });

  it("truncates long bodies and skips non-text request bodies", async () => {
    const { messages, realFetch } = await loadInject({ captureBodies: true });
    realFetch.mockResolvedValue(new Response("x".repeat(MAX_BODY_CHARS + 1)));

    await window.fetch(API_URL, { method: "post", body: new Blob(["binario"]) });
    await vi.waitFor(() => {
      expect(capturedBodies(messages)).toHaveLength(1);
    });

    const [bodies] = capturedBodies(messages);
    expect(bodies?.requestBody).toBeNull();
    expect(bodies?.responseBody).toHaveLength(MAX_BODY_CHARS);
    expect(bodies?.truncated).toBe(true);
  });

  it("marks as truncated when only the request body is long", async () => {
    const { messages } = await loadInject({ captureBodies: true });

    await window.fetch(API_URL, { method: "post", body: "y".repeat(MAX_BODY_CHARS + 1) });
    await vi.waitFor(() => {
      expect(capturedBodies(messages)[0]?.truncated).toBe(true);
    });
  });

  it("skips the report when the response body cannot be read", async () => {
    const { messages, realFetch } = await loadInject({ captureBodies: true });
    const broken = new ReadableStream({
      start: (controller) => {
        controller.error(new Error("stream roto"));
      },
    });
    realFetch.mockResolvedValue(new Response(broken));

    await window.fetch(API_URL);
    await flush();
    await flush();

    expect(capturedBodies(messages)).toHaveLength(0);
  });
});

describe("inject: XMLHttpRequest", () => {
  it("parses the mock body for json responses and yields null for invalid json", async () => {
    await loadInject({ mocks: [mockRule({ body: '{"ok":true}' })] });
    const asJson = await runXhr(API_URL, { responseType: "json" });
    expect(asJson.response).toEqual({ ok: true });

    await loadInject({ mocks: [mockRule({ body: "no es json" })] });
    const broken = await runXhr(API_URL, { responseType: "json" });
    const plain = await runXhr(API_URL);
    expect(broken.response).toBeNull();
    expect(plain.response).toBe("no es json");
    expect(plain.getResponseHeader("x-falta")).toBeNull();
  });

  it("applies the chaos delay before answering", async () => {
    await loadInject({ chaos: [chaosRule({ delayMs: 5, failRate: 100, failStatus: 418 })] });

    const xhr = await runXhr(API_URL);

    expect(xhr.status).toBe(418);
  });

  it("sends unmatched requests to the network and captures their bodies", async () => {
    const { network, messages } = await loadInject({ captureBodies: true });

    await runXhr(API_URL, { body: "pedido" });

    expect(network.sentBodies).toEqual(["pedido"]);
    await vi.waitFor(() => {
      expect(capturedBodies(messages)).toEqual([
        {
          url: API_URL,
          method: "POST",
          requestBody: "pedido",
          responseBody: "respuesta real",
          truncated: false,
        },
      ]);
    });
  });

  it("reports a null response when the xhr text is not readable", async () => {
    const { network, messages } = await loadInject({ captureBodies: true });
    network.respondWith(() => {
      throw new Error("responseType no es texto");
    });
    await runXhr(API_URL);

    network.respondWith(() => 42);
    await runXhr(API_URL);

    await vi.waitFor(() => {
      expect(capturedBodies(messages)).toHaveLength(2);
    });
    expect(capturedBodies(messages).map((bodies) => bodies.responseBody)).toEqual([null, null]);
    expect(capturedBodies(messages).map((bodies) => bodies.requestBody)).toEqual([null, null]);
  });

  it("does not capture when capture is off", async () => {
    const { network, messages } = await loadInject();

    await runXhr(API_URL, { body: "pedido" });
    await flush();

    expect(network.sentBodies).toEqual(["pedido"]);
    expect(capturedBodies(messages)).toHaveLength(0);
  });

  it("sends requests it never saw opened straight to the original send", async () => {
    const { network } = await loadInject({ mocks: [mockRule()] });

    new XMLHttpRequest().send("sin open");

    expect(network.sentBodies).toEqual(["sin open"]);
  });
});

describe("inject: sendBeacon", () => {
  it("leaves sendBeacon alone when the browser does not have it", async () => {
    await loadInject({}, { withBeacon: false });

    expect("sendBeacon" in navigator).toBe(false);
  });

  it("reports the hit of a mocked beacon", async () => {
    const { messages } = await loadInject({ mocks: [mockRule({ name: "Analytics" })] });

    expect(navigator.sendBeacon(new URL("https://analytics.example.com/collect"))).toBe(true);
    await flush();

    expect(messages).toContainEqual(
      expect.objectContaining({ type: "mock-hit", ruleName: "Analytics", method: "POST" }),
    );
  });
});
