import { describe, expect, it } from "vitest";
import { mapEpisode, mapMovie, mapSeries } from "@/ingest/mappers";
import type { TmdbEpisode, TmdbMovie, TmdbSeries } from "@/ingest/tmdb/types";

const MOVIE: TmdbMovie = {
  id: 11,
  title: "Star Wars",
  original_title: "Star Wars",
  release_date: "1977-05-25",
  runtime: 121,
  overview: "A long time ago...",
  original_language: "en",
  external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" },
};

describe("mapMovie", () => {
  it("maps a movie to a work + THEATRICAL edition + TMDB/IMDB/WIKIDATA refs", () => {
    const mapped = mapMovie(MOVIE);
    expect(mapped.tmdbId).toBe(11);
    expect(mapped.work.type).toBe("MOVIE");
    expect(mapped.work.title).toBe("Star Wars");
    expect(mapped.work.year).toBe(1977);
    expect(mapped.edition).toEqual({ format: "THEATRICAL", runtimeMs: 121 * 60_000, language: "en", releaseDate: "1977-05-25" });
    expect(mapped.refs.map((r) => r.provider).sort()).toEqual(["IMDB", "TMDB", "WIKIDATA"]);
    expect(mapped.refs.find((r) => r.provider === "IMDB")?.url).toBe("https://www.imdb.com/title/tt0076759/");
  });

  it("null runtime and missing external ids degrade gracefully", () => {
    const mapped = mapMovie({ ...MOVIE, runtime: null, external_ids: { imdb_id: null, wikidata_id: null } });
    expect(mapped.edition?.runtimeMs).toBeNull();
    expect(mapped.refs.map((r) => r.provider)).toEqual(["TMDB"]);
  });

  it("empty-string release_date maps to a null edition releaseDate", () => {
    const mapped = mapMovie({ ...MOVIE, release_date: "" });
    expect(mapped.edition?.releaseDate).toBeNull();
  });
});

describe("mapSeries", () => {
  it("maps a series to a work with no edition", () => {
    const series: TmdbSeries = {
      id: 1399,
      name: "Game of Thrones",
      original_name: "Game of Thrones",
      first_air_date: "2011-04-17",
      overview: "Nine noble families...",
      seasons: [{ season_number: 1 }],
      external_ids: { imdb_id: "tt0944947", wikidata_id: "Q23572" },
    };
    const mapped = mapSeries(series);
    expect(mapped.work.type).toBe("TV_SERIES");
    expect(mapped.work.year).toBe(2011);
    expect(mapped.edition).toBeNull();
    expect(mapped.refs.map((r) => r.provider).sort()).toEqual(["IMDB", "TMDB", "WIKIDATA"]);
  });
});

describe("mapEpisode", () => {
  it("maps an episode to a TV_EPISODE work + TV_BROADCAST edition + TMDB ref only", () => {
    const episode: TmdbEpisode = {
      id: 63056,
      episode_number: 1,
      season_number: 1,
      name: "Winter Is Coming",
      overview: "Eddard Stark...",
      runtime: 62,
      air_date: "2011-04-17",
    };
    const mapped = mapEpisode(1399, episode);
    expect(mapped.tmdbId).toBe(63056);
    expect(mapped.work.type).toBe("TV_EPISODE");
    expect(mapped.work.seasonNumber).toBe(1);
    expect(mapped.work.episodeNumber).toBe(1);
    expect(mapped.edition).toEqual({ format: "TV_BROADCAST", runtimeMs: 62 * 60_000, language: null, releaseDate: "2011-04-17" });
    expect(mapped.refs.map((r) => r.provider)).toEqual(["TMDB"]);
    expect(mapped.tmdbUrl).toBe("https://www.themoviedb.org/tv/1399/season/1/episode/1");
  });

  it("empty-string air_date maps to a null edition releaseDate", () => {
    const episode: TmdbEpisode = {
      id: 63056,
      episode_number: 1,
      season_number: 1,
      name: "Winter Is Coming",
      overview: "Eddard Stark...",
      runtime: 62,
      air_date: "",
    };
    const mapped = mapEpisode(1399, episode);
    expect(mapped.edition?.releaseDate).toBeNull();
  });
});
