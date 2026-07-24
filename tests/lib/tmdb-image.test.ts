import { describe, expect, it } from "vitest";
import { tmdbPosterUrl } from "@/lib/tmdb-image";

describe("tmdbPosterUrl", () => {
  it("builds a URL at the default size", () => {
    expect(tmdbPosterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });
  it("honors an explicit size", () => {
    expect(tmdbPosterUrl("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
  });
  it("normalizes a path missing its leading slash", () => {
    expect(tmdbPosterUrl("abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });
  it("returns null when there is no path", () => {
    expect(tmdbPosterUrl(null)).toBeNull();
    expect(tmdbPosterUrl(undefined)).toBeNull();
    expect(tmdbPosterUrl("")).toBeNull();
  });
});
