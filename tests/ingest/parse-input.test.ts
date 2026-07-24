import { describe, expect, it } from "vitest";
import { parseInput } from "@/ingest/parse-input";

describe("parseInput", () => {
  it("parses short movie/tv forms", () => {
    expect(parseInput("movie/11")).toEqual({ source: "tmdb", type: "movie", id: 11 });
    expect(parseInput("tv/1399")).toEqual({ source: "tmdb", type: "tv", id: 1399 });
  });

  it("parses full TMDB URLs and ignores trailing segments", () => {
    expect(parseInput("https://www.themoviedb.org/movie/11-star-wars")).toEqual({ source: "tmdb", type: "movie", id: 11 });
    expect(parseInput("https://www.themoviedb.org/tv/1399/season/1")).toEqual({ source: "tmdb", type: "tv", id: 1399 });
  });

  it("parses IBDB isbn forms (bare and .json URL)", () => {
    expect(parseInput("isbn/9780593820247")).toEqual({ source: "ibdb", kind: "isbn", value: "9780593820247" });
    expect(parseInput("https://ibdb.dev/isbn/9780593820247.json")).toEqual({
      source: "ibdb",
      kind: "isbn",
      value: "9780593820247",
    });
  });

  it("parses IBDB book forms", () => {
    const id = "03ba0b4d-e7c4-4977-8b1f-86020319b07a";
    expect(parseInput(`book/${id}`)).toEqual({ source: "ibdb", kind: "book", value: id });
    expect(parseInput(`https://ibdb.dev/book/${id}.json`)).toEqual({ source: "ibdb", kind: "book", value: id });
  });

  it("throws on unrecognized input", () => {
    expect(() => parseInput("person/500")).toThrow();
    expect(() => parseInput("movie/")).toThrow();
    expect(() => parseInput("nonsense")).toThrow();
  });
});
