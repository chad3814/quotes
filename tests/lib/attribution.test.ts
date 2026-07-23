import { describe, expect, it } from "vitest";
import { validateSpan } from "@/lib/attribution";

const CONTENT = "Use the Force, Luke. Let go.";

describe("validateSpan", () => {
  it("accepts a span that resolves to the referenced text", () => {
    expect(validateSpan(CONTENT, 15, 19)).toEqual({ ok: true });
  });

  it("accepts a fully-absent span (both null)", () => {
    expect(validateSpan(CONTENT, null, null)).toEqual({ ok: true });
    expect(validateSpan(CONTENT, undefined, undefined)).toEqual({ ok: true });
  });

  it("rejects a half-specified span", () => {
    expect(validateSpan(CONTENT, 15, null).ok).toBe(false);
    expect(validateSpan(CONTENT, null, 19).ok).toBe(false);
  });

  it("rejects start >= end", () => {
    expect(validateSpan(CONTENT, 19, 19).ok).toBe(false);
    expect(validateSpan(CONTENT, 19, 15).ok).toBe(false);
  });

  it("rejects out-of-bounds offsets", () => {
    expect(validateSpan(CONTENT, -1, 4).ok).toBe(false);
    expect(validateSpan(CONTENT, 0, CONTENT.length + 1).ok).toBe(false);
  });

  it("rejects a non-integer offset", () => {
    expect(validateSpan("hello", 1, 2.5).ok).toBe(false);
  });

  it("accepts the exact upper boundary where end equals content length", () => {
    expect(validateSpan("hello", 0, 5)).toEqual({ ok: true });
  });
});
