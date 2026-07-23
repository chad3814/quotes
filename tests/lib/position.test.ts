import { describe, expect, it } from "vitest";
import { validatePosition } from "@/lib/position";

describe("validatePosition", () => {
  it("accepts a timestamp within an AV runtime", () => {
    const result = validatePosition(
      { startMs: 5000, endMs: 8000 },
      { format: "THEATRICAL", runtimeMs: 7_200_000, pageCount: null },
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a timestamp past the runtime", () => {
    const result = validatePosition(
      { startMs: 9_000_000 },
      { format: "THEATRICAL", runtimeMs: 7_200_000, pageCount: null },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects endMs before startMs", () => {
    const result = validatePosition(
      { startMs: 8000, endMs: 5000 },
      { format: "DIRECTORS_CUT", runtimeMs: null, pageCount: null },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a page within a print page count", () => {
    const result = validatePosition({ page: 42 }, { format: "HARDCOVER", runtimeMs: null, pageCount: 300 });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a page beyond the page count", () => {
    const result = validatePosition({ page: 500 }, { format: "PAPERBACK", runtimeMs: null, pageCount: 300 });
    expect(result.ok).toBe(false);
  });

  it("rejects a percent outside 0..100 for ebooks", () => {
    const result = validatePosition({ percent: 150 }, { format: "EBOOK", runtimeMs: null, pageCount: null });
    expect(result.ok).toBe(false);
  });

  it("accepts an empty position", () => {
    expect(validatePosition({}, { format: "THEATRICAL", runtimeMs: null, pageCount: null })).toEqual({ ok: true });
  });
});
