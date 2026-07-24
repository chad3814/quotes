import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, externalReferences, works } from "@/db/schema";
import { upsertWork } from "@/ingest/upsert";
import type { MappedWork } from "@/ingest/mappers";

const MOVIE: MappedWork = {
  tmdbId: 11,
  tmdbUrl: "https://www.themoviedb.org/movie/11",
  work: { type: "MOVIE", title: "Star Wars", originalTitle: "Star Wars", year: 1977, seasonNumber: null, episodeNumber: null, synopsis: "...", posterPath: "/sw.jpg" },
  edition: { format: "THEATRICAL", runtimeMs: 7_260_000, language: "en", releaseDate: "1977-05-25" },
  refs: [
    { provider: "TMDB", externalId: "11", url: "https://www.themoviedb.org/movie/11" },
    { provider: "IMDB", externalId: "tt0076759", url: "https://www.imdb.com/title/tt0076759/" },
  ],
};

describe("upsertWork", () => {
  it("creates a work, edition, and refs on first run", async () => {
    const db = await createTestDb();
    const result = await upsertWork(db, MOVIE, null);
    expect(result.workCreated).toBe(true);
    expect(result.editionCreated).toBe(true);
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(1);
    // 2 WORK refs (TMDB, IMDB) + 1 EDITION ref (TMDB)
    expect(await db.select().from(externalReferences)).toHaveLength(3);
  });

  it("is idempotent: a second run creates no duplicates and updates fields", async () => {
    const db = await createTestDb();
    await upsertWork(db, MOVIE, null);
    const second = await upsertWork(db, { ...MOVIE, work: { ...MOVIE.work, title: "Star Wars: A New Hope" } }, null);
    expect(second.workCreated).toBe(false);
    expect(second.editionCreated).toBe(false);
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(1);
    expect(await db.select().from(externalReferences)).toHaveLength(3);
    const [row] = await db.select().from(works).where(eq(works.id, second.workId));
    expect(row.title).toBe("Star Wars: A New Hope");
  });

  it("sets parentWorkId for episodes", async () => {
    const db = await createTestDb();
    const parent = await upsertWork(db, { ...MOVIE, tmdbId: 999, work: { ...MOVIE.work, type: "TV_SERIES" }, edition: null, refs: [{ provider: "TMDB", externalId: "999", url: "u" }] }, null);
    const episode: MappedWork = {
      tmdbId: 63056,
      tmdbUrl: "u",
      work: { type: "TV_EPISODE", title: "Ep", originalTitle: null, year: 2011, seasonNumber: 1, episodeNumber: 1, synopsis: null, posterPath: null },
      edition: { format: "TV_BROADCAST", runtimeMs: null, language: null, releaseDate: null },
      refs: [{ provider: "TMDB", externalId: "63056", url: "u" }],
    };
    const res = await upsertWork(db, episode, parent.workId);
    const [row] = await db.select().from(works).where(eq(works.id, res.workId));
    expect(row.parentWorkId).toBe(parent.workId);
  });
});
