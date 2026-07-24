import { describe, expect, it } from "vitest";
import { posterImageUrl } from "@/lib/tmdb-image";

describe("posterImageUrl", () => {
  it("builds a TMDB URL from a path at the default size", () => {
    expect(posterImageUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });
  it("honors an explicit size", () => {
    expect(posterImageUrl("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
  });
  it("normalizes a path missing its leading slash", () => {
    expect(posterImageUrl("abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });
  it("passes a full URL through unchanged (e.g. a book cover)", () => {
    const url = "https://images.isbndb.com/covers/11192263482399.jpg";
    expect(posterImageUrl(url)).toBe(url);
    expect(posterImageUrl(url, "w500")).toBe(url);
  });
  it("returns null when there is no path", () => {
    expect(posterImageUrl(null)).toBeNull();
    expect(posterImageUrl(undefined)).toBeNull();
    expect(posterImageUrl("")).toBeNull();
  });
});
