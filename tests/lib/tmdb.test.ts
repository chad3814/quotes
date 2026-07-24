import { describe, expect, it } from "vitest";
import { tmdbInputForWork } from "@/lib/tmdb";

describe("tmdbInputForWork", () => {
  it("maps a movie to a movie ingest input", () => {
    expect(tmdbInputForWork("MOVIE", "11")).toEqual({ source: "tmdb", type: "movie", id: 11 });
  });

  it("maps a TV series to a tv ingest input", () => {
    expect(tmdbInputForWork("TV_SERIES", "1399")).toEqual({ source: "tmdb", type: "tv", id: 1399 });
  });

  it("returns null for episodes and books (not re-syncable as top-level titles)", () => {
    expect(tmdbInputForWork("TV_EPISODE", "63056")).toBeNull();
    expect(tmdbInputForWork("BOOK", "42")).toBeNull();
  });

  it("returns null for a non-numeric or non-positive external id", () => {
    expect(tmdbInputForWork("MOVIE", "tt0076759")).toBeNull();
    expect(tmdbInputForWork("MOVIE", "0")).toBeNull();
    expect(tmdbInputForWork("MOVIE", "-5")).toBeNull();
    expect(tmdbInputForWork("MOVIE", "")).toBeNull();
  });
});
