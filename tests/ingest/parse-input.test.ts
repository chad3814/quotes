import { describe, expect, it } from "vitest";
import { parseInput } from "@/ingest/parse-input";

describe("parseInput", () => {
  it("parses short movie/tv forms", () => {
    expect(parseInput("movie/11")).toEqual({ type: "movie", id: 11 });
    expect(parseInput("tv/1399")).toEqual({ type: "tv", id: 1399 });
  });

  it("parses full TMDB URLs with a slug suffix", () => {
    expect(parseInput("https://www.themoviedb.org/movie/11-star-wars")).toEqual({ type: "movie", id: 11 });
    expect(parseInput("https://www.themoviedb.org/tv/1399-game-of-thrones")).toEqual({ type: "tv", id: 1399 });
  });

  it("ignores trailing path segments on URLs", () => {
    expect(parseInput("https://www.themoviedb.org/tv/1399/season/1")).toEqual({ type: "tv", id: 1399 });
  });

  it("throws on unrecognized input", () => {
    expect(() => parseInput("person/500")).toThrow();
    expect(() => parseInput("movie/")).toThrow();
    expect(() => parseInput("nonsense")).toThrow();
  });
});
