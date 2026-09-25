// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadJson, readFileAsText } from "@/lib/download";

const OBJECT_URL = "blob:bender/123";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadJson", () => {
  it("clicks a link to a pretty printed json blob and releases the url", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => OBJECT_URL);
    const revokeObjectURL = vi.fn<(url: string) => void>();
    class UrlWithObjectUrls extends URL {
      static override readonly createObjectURL = createObjectURL;
      static override readonly revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", UrlWithObjectUrls);
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function recordClick(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadJson("perfiles.json", { ok: true });

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe("perfiles.json");
    expect(clicked[0]?.href).toBe(OBJECT_URL);
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe("application/json");
    await expect(blob?.text()).resolves.toBe('{\n  "ok": true\n}');
  });
});

describe("readFileAsText", () => {
  it("resolves with the file contents", async () => {
    const file = new File(["hola bender"], "notas.txt", { type: "text/plain" });

    await expect(readFileAsText(file)).resolves.toBe("hola bender");
  });

  it("rejects with the reader error", async () => {
    const readerError = new DOMException("denied", "NotReadableError");
    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function failRead(this: FileReader) {
      Object.defineProperty(this, "error", { value: readerError });
      this.dispatchEvent(new ProgressEvent("error"));
    });

    await expect(readFileAsText(new File(["x"], "x.txt"))).rejects.toBe(readerError);
  });

  it("rejects with a generic error when the reader has none", async () => {
    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function failRead(this: FileReader) {
      this.dispatchEvent(new ProgressEvent("error"));
    });

    await expect(readFileAsText(new File(["x"], "x.txt"))).rejects.toThrow("No se pudo leer el archivo");
  });

  it("resolves an empty string when the result is not text", async () => {
    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function loadBinary(this: FileReader) {
      Object.defineProperty(this, "result", { value: new ArrayBuffer(2) });
      this.dispatchEvent(new ProgressEvent("load"));
    });

    await expect(readFileAsText(new File(["x"], "x.txt"))).resolves.toBe("");
  });
});
