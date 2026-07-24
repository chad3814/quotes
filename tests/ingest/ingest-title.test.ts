import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { works } from "@/db/schema";
import { ingestTitle } from "@/ingest/ingest-title";
import type { TmdbClient, TmdbMovie, TmdbSearchResult, TmdbSeason, TmdbSeries } from "@/ingest/tmdb/types";

const MOVIE: TmdbMovie = {
  id: 11, title: "Star Wars", original_title: "Star Wars", release_date: "1977-05-25",
  runtime: 121, overview: "...", original_language: "en", external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" },
};
const SERIES: TmdbSeries = {
  id: 1399, name: "GoT", original_name: "GoT", first_air_date: "2011-04-17", overview: "...",
  seasons: [{ season_number: 1 }], external_ids: { imdb_id: "tt0944947", wikidata_id: "Q23572" },
};
const SEASON_1: TmdbSeason = {
  season_number: 1,
  episodes: [
    { id: 63056, episode_number: 1, season_number: 1, name: "Ep1", overview: "", runtime: 62, air_date: "2011-04-17" },
    { id: 63057, episode_number: 2, season_number: 1, name: "Ep2", overview: "", runtime: 55, air_date: "2011-04-24" },
  ],
};

class FakeTmdb implements TmdbClient {
  constructor(private seasons: Record<number, TmdbSeason> = { 1: SEASON_1 }) {}
  async getMovie(): Promise<TmdbMovie> { return MOVIE; }
  async getSeries(): Promise<TmdbSeries> { return SERIES; }
  async getSeason(_seriesId: number, seasonNumber: number): Promise<TmdbSeason> { return this.seasons[seasonNumber]; }
  async search(): Promise<TmdbSearchResult[]> { return []; }
}

describe("ingestTitle", () => {
  it("ingests a movie", async () => {
    const db = await createTestDb();
    const summary = await ingestTitle(db, new FakeTmdb(), { type: "movie", id: 11 });
    expect(summary.type).toBe("movie");
    expect(summary.workCreated).toBe(true);
    expect(await db.select().from(works)).toHaveLength(1);
  });

  it("ingests a series with all episodes as child works", async () => {
    const db = await createTestDb();
    const summary = await ingestTitle(db, new FakeTmdb(), { type: "tv", id: 1399 });
    expect(summary.episodesCreated).toBe(2);
    const rows = await db.select().from(works);
    expect(rows).toHaveLength(3); // series + 2 episodes
    const episodes = rows.filter((r) => r.type === "TV_EPISODE");
    expect(episodes.every((e) => e.parentWorkId === summary.workId)).toBe(true);
  });

  it("is idempotent and picks up newly-added episodes on re-run", async () => {
    const db = await createTestDb();
    await ingestTitle(db, new FakeTmdb(), { type: "tv", id: 1399 });
    const withNewEpisode: Record<number, TmdbSeason> = {
      1: { season_number: 1, episodes: [...SEASON_1.episodes, { id: 63058, episode_number: 3, season_number: 1, name: "Ep3", overview: "", runtime: 58, air_date: "2011-05-01" }] },
    };
    const summary = await ingestTitle(db, new FakeTmdb(withNewEpisode), { type: "tv", id: 1399 });
    expect(summary.episodesCreated).toBe(1);
    expect(summary.episodesUpdated).toBe(2);
    expect(await db.select().from(works)).toHaveLength(4); // series + 3 episodes, no duplicates
  });
});
