import { describe, expect, it } from "vitest";
import { buildSearchText } from "@/lib/search-text";

describe("buildSearchText", () => {
  it("joins line contents in ordinal order with newlines", () => {
    const text = buildSearchText([
      { ordinal: 1, content: "I know." },
      { ordinal: 0, content: "I love you." },
    ]);
    expect(text).toBe("I love you.\nI know.");
  });

  it("returns an empty string for no lines", () => {
    expect(buildSearchText([])).toBe("");
  });

  it("trims each line and drops blank lines", () => {
    const text = buildSearchText([
      { ordinal: 0, content: "  hello  " },
      { ordinal: 1, content: "   " },
      { ordinal: 2, content: "world" },
    ]);
    expect(text).toBe("hello\nworld");
  });
});
