import { describe, expect, it } from "vitest";
import { quoteSlugBase, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("  Star Wars: A New Hope!  ")).toBe("star-wars-a-new-hope");
  });

  it("collapses repeated separators and strips leading/trailing hyphens", () => {
    expect(slugify("--The   Office (US)--")).toBe("the-office-us");
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("quoteSlugBase", () => {
  it("builds a base from the first line's leading words", () => {
    const base = quoteSlugBase([{ ordinal: 0, content: "Use the Force, Luke. Let go." }]);
    expect(base).toBe("use-the-force-luke-let-go");
  });

  it("uses the lowest-ordinal line and caps the word count", () => {
    const base = quoteSlugBase([
      { ordinal: 1, content: "second line here" },
      { ordinal: 0, content: "one two three four five six seven eight" },
    ]);
    expect(base).toBe("one-two-three-four-five-six");
  });

  it("falls back to 'quote' when the first line has no slug-able words", () => {
    expect(quoteSlugBase([{ ordinal: 0, content: "!!!" }])).toBe("quote");
  });
});
