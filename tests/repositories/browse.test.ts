import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork, getWorkBySlug, listWorks } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";
import { createQuote, getQuoteBySlug, getRandomQuote, listRecentQuotes } from "@/repositories/quotes";
import { listCharacters } from "@/repositories/characters";
import { searchQuotes } from "@/repositories/search";
import { renderHeadline } from "@/lib/highlight";
import { getLibraryStats } from "@/repositories/stats";

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  const movie = await createWork(db, { type: "MOVIE", title: "A New Hope", year: 1977 });
  const movieEdition = await createEdition(db, { workId: movie.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
  const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
  const luke = await createCharacter(db, { name: "Luke Skywalker" });
  const forceQuote = await createQuote(db, {
    editionId: movieEdition.id,
    position: { startMs: 5000 },
    lines: [
      {
        type: "DIALOG",
        content: "Use the Force, Luke.",
        attributions: [
          { characterId: obiwan.id, role: "SPEAKER" },
          { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
        ],
      },
    ],
  });

  const series = await createWork(db, { type: "TV_SERIES", title: "The Office", year: 2005 });
  const episode = await createWork(db, {
    type: "TV_EPISODE",
    title: "Dinner Party",
    parentWorkId: series.id,
    seasonNumber: 4,
    episodeNumber: 13,
  });
  const episodeEdition = await createEdition(db, { workId: episode.id, format: "TV_BROADCAST" });
  await createQuote(db, {
    editionId: episodeEdition.id,
    lines: [{ type: "DIALOG", content: "I declare bankruptcy!", attributions: [{ characterId: luke.id, role: "SPEAKER" }] }],
  });

  return { movie, series, episode, forceQuote, obiwan, luke };
}

describe("listWorks", () => {
  it("lists only top-level works with quote counts", async () => {
    const db = await createTestDb();
    await seed(db);
    const top = await listWorks(db, { topLevelOnly: true });
    expect(top.map((w) => w.title)).toEqual(["A New Hope", "The Office"]);
    const movie = top.find((w) => w.title === "A New Hope");
    expect(movie?.quoteCount).toBe(1);
    // The series has no direct quotes, but its quote count includes its episodes' (1).
    expect(top.find((w) => w.title === "The Office")?.quoteCount).toBe(1);
  });

  it("filters by type", async () => {
    const db = await createTestDb();
    await seed(db);
    const movies = await listWorks(db, { type: "MOVIE" });
    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe("A New Hope");
  });

  it("lists child works (episodes) of a parent", async () => {
    const db = await createTestDb();
    const { series } = await seed(db);
    const children = await listWorks(db, { parentId: series.id });
    expect(children).toHaveLength(1);
    expect(children[0].title).toBe("Dinner Party");
    expect(children[0].seasonNumber).toBe(4);
    expect(children[0].quoteCount).toBe(1);
  });
});

describe("getWorkBySlug (enriched)", () => {
  it("returns synopsis, parent link, and child works", async () => {
    const db = await createTestDb();
    const { series, episode } = await seed(db);

    const seriesPage = await getWorkBySlug(db, series.slug);
    expect(seriesPage?.parent).toBeNull();
    expect(seriesPage?.children.map((c) => c.title)).toEqual(["Dinner Party"]);

    const episodePage = await getWorkBySlug(db, episode.slug);
    expect(episodePage?.parent?.title).toBe("The Office");
    expect(episodePage?.seasonNumber).toBe(4);
    expect(episodePage?.editions[0].quotes).toHaveLength(1);
  });
});

describe("listCharacters", () => {
  it("lists characters with distinct quote counts", async () => {
    const db = await createTestDb();
    await seed(db);
    const chars = await listCharacters(db);
    expect(chars.map((c) => c.name)).toEqual(["Luke Skywalker", "Obi-Wan Kenobi"]);
    // Luke speaks in the episode quote and is a subject in the movie quote → 2 distinct quotes.
    expect(chars.find((c) => c.name === "Luke Skywalker")?.quoteCount).toBe(2);
    expect(chars.find((c) => c.name === "Obi-Wan Kenobi")?.quoteCount).toBe(1);
  });
});

describe("listRecentQuotes", () => {
  it("returns quotes with their source work", async () => {
    const db = await createTestDb();
    await seed(db);
    const recent = await listRecentQuotes(db, 10);
    expect(recent).toHaveLength(2);
    const force = recent.find((q) => q.preview.includes("Use the Force"));
    expect(force?.work.title).toBe("A New Hope");
    expect(force?.work.type).toBe("MOVIE");
  });

  it("respects the limit", async () => {
    const db = await createTestDb();
    await seed(db);
    expect(await listRecentQuotes(db, 1)).toHaveLength(1);
  });
});

describe("getQuoteBySlug (enriched)", () => {
  it("returns the source work, edition, and position", async () => {
    const db = await createTestDb();
    const { forceQuote } = await seed(db);
    const detail = await getQuoteBySlug(db, forceQuote.slug);
    expect(detail?.source.work.title).toBe("A New Hope");
    expect(detail?.source.work.type).toBe("MOVIE");
    expect(detail?.source.edition.format).toBe("THEATRICAL");
    expect(detail?.position.startMs).toBe(5000);
  });
});

describe("searchQuotes (enriched)", () => {
  it("includes the source work in results", async () => {
    const db = await createTestDb();
    await seed(db);
    const results = await searchQuotes(db, "force");
    expect(results).toHaveLength(1);
    expect(results[0].work.title).toBe("A New Hope");
    expect(results[0].work.year).toBe(1977);
    expect(renderHeadline(results[0].headline).toLowerCase()).toContain("<mark>force</mark>");
  });
});

describe("getLibraryStats", () => {
  it("counts works, quotes, and characters", async () => {
    const db = await createTestDb();
    await seed(db);
    const stats = await getLibraryStats(db);
    expect(stats.works).toBe(3); // movie, series, episode
    expect(stats.quotes).toBe(2);
    expect(stats.characters).toBe(2);
  });
});

describe("listWorks quoteCount includes child works", () => {
  it("sums a series' quotes across all its episodes", async () => {
    const db = await createTestDb();
    const series = await createWork(db, { type: "TV_SERIES", title: "Show" });
    const e1 = await createWork(db, { type: "TV_EPISODE", title: "E1", parentWorkId: series.id, seasonNumber: 1, episodeNumber: 1 });
    const e2 = await createWork(db, { type: "TV_EPISODE", title: "E2", parentWorkId: series.id, seasonNumber: 1, episodeNumber: 2 });
    const ed1 = await createEdition(db, { workId: e1.id, format: "TV_BROADCAST" });
    const ed2 = await createEdition(db, { workId: e2.id, format: "TV_BROADCAST" });
    await createQuote(db, { editionId: ed1.id, lines: [{ type: "DIALOG", content: "one" }] });
    await createQuote(db, { editionId: ed2.id, lines: [{ type: "DIALOG", content: "two" }] });
    await createQuote(db, { editionId: ed2.id, lines: [{ type: "DIALOG", content: "three" }] });

    const [seriesRow] = await listWorks(db, { topLevelOnly: true, type: "TV_SERIES" });
    expect(seriesRow.quoteCount).toBe(3); // 0 direct + 1 (E1) + 2 (E2)

    // Episodes still report only their own quotes.
    const episodes = await listWorks(db, { parentId: series.id });
    expect(episodes.map((e) => e.quoteCount).sort()).toEqual([1, 2]);
  });
});

describe("getRandomQuote", () => {
  it("returns a quote with its source work", async () => {
    const db = await createTestDb();
    await seed(db);
    const quote = await getRandomQuote(db);
    expect(quote).not.toBeNull();
    expect(quote?.slug).toBeTruthy();
    expect(quote?.text.length).toBeGreaterThan(0);
    expect(quote?.work.title).toBeTruthy();
  });

  it("returns null when there are no quotes", async () => {
    const db = await createTestDb();
    expect(await getRandomQuote(db)).toBeNull();
  });
});
