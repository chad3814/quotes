import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { characters, editions, quotes, works } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";
import { getQuoteById, getQuoteBySlug } from "@/repositories/quotes";
import { authorQuote, editQuote } from "@/repositories/quote-authoring";

describe("authorQuote", () => {
  it("creates a quote on an existing edition, resolving speaker + subjects", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars", year: 1977 });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    await createCharacter(db, { name: "Obi-Wan Kenobi" }); // pre-existing → should be reused

    const { slug } = await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      lines: [
        { type: "DIALOG", content: "Use the Force, Luke.", speaker: "Obi-Wan Kenobi", subjects: ["Luke Skywalker"] },
      ],
      position: { start: "1:00:00" },
    });

    const detail = await getQuoteBySlug(db, slug);
    expect(detail?.source.work.title).toBe("Star Wars");
    expect(detail?.position.startMs).toBe(3_600_000);
    const attrs = detail?.lines[0].attributions ?? [];
    expect(attrs.find((a) => a.role === "SPEAKER")?.characterName).toBe("Obi-Wan Kenobi");
    expect(attrs.find((a) => a.role === "SUBJECT")?.characterName).toBe("Luke Skywalker");
    // Obi-Wan reused, Luke created → 2 characters total.
    expect(await db.select().from(characters)).toHaveLength(2);
  });

  it("reuses an existing character when a new speaker name differs only in case", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    await createCharacter(db, { name: "Obi-Wan Kenobi" });

    await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      // Typed by hand with different casing/whitespace — must not create a duplicate.
      lines: [{ type: "DIALOG", content: "Hello there.", speaker: "  obi-wan kenobi " }],
    });

    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it("binds a picked character by id without matching on name", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });

    const { slug } = await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      // A stale/edited name string is ignored when an id is present — the id wins.
      lines: [{ type: "DIALOG", content: "Hello there.", speaker: { id: obiwan.id, name: "typo name" } }],
    });

    expect(await db.select().from(characters)).toHaveLength(1);
    const detail = await getQuoteBySlug(db, slug);
    expect(detail?.lines[0].attributions.find((a) => a.role === "SPEAKER")?.characterName).toBe("Obi-Wan Kenobi");
  });

  it("de-duplicates a subject picked by id and typed again by name", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    const grievous = await createCharacter(db, { name: "Grievous" });

    const { slug } = await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      lines: [{ type: "DIALOG", content: "General Kenobi.", subjects: [{ id: grievous.id, name: "Grievous" }, "grievous"] }],
    });

    const detail = await getQuoteBySlug(db, slug);
    const subjects = detail?.lines[0].attributions.filter((attr) => attr.role === "SUBJECT") ?? [];
    expect(subjects).toHaveLength(1);
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it("creates the work and edition for a 'new work' submission", async () => {
    const db = await createTestDb();
    const { slug } = await authorQuote(db, {
      edition: { mode: "new", workType: "BOOK", title: "Dune", year: "1965", format: "HARDCOVER" },
      lines: [{ type: "PROSE", content: "Fear is the mind-killer.", subjects: ["Paul Atreides"] }],
      position: { page: "12" },
    });
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(1);
    const detail = await getQuoteBySlug(db, slug);
    expect(detail?.source.work.title).toBe("Dune");
    expect(detail?.source.edition.format).toBe("HARDCOVER");
    expect(detail?.position.page).toBe(12);
  });

  it("de-duplicates a repeated subject name on a line", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    const { slug } = await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      lines: [{ type: "DIALOG", content: "Hello there.", speaker: "Obi-Wan", subjects: ["Grievous", "Grievous"] }],
    });
    const detail = await getQuoteBySlug(db, slug);
    const subjects = detail?.lines[0].attributions.filter((attr) => attr.role === "SUBJECT") ?? [];
    expect(subjects).toHaveLength(1);
    expect(subjects[0].characterName).toBe("Grievous");
  });

  it("throws when there are no non-empty lines", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "X" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    await expect(
      authorQuote(db, { edition: { mode: "existing", id: edition.id }, lines: [{ type: "DIALOG", content: "   " }] }),
    ).rejects.toThrow(/at least one line/);
    expect(await db.select().from(quotes)).toHaveLength(0);
  });

  it("rolls back a 'new work' submission when the quote is invalid (no orphans)", async () => {
    const db = await createTestDb();
    await expect(
      authorQuote(db, {
        // startMs is invalid for a non-time-based (book) format → createQuote rejects.
        edition: { mode: "new", workType: "BOOK", title: "Dune", format: "HARDCOVER" },
        lines: [{ type: "PROSE", content: "Fear is the mind-killer." }],
        position: { start: "1:00" },
      }),
    ).rejects.toThrow();
    expect(await db.select().from(works)).toHaveLength(0);
    expect(await db.select().from(editions)).toHaveLength(0);
    expect(await db.select().from(quotes)).toHaveLength(0);
  });

  it("rejects a non-numeric page", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "BOOK", title: "Dune" });
    const edition = await createEdition(db, { workId: work.id, format: "HARDCOVER" });
    await expect(
      authorQuote(db, {
        edition: { mode: "existing", id: edition.id },
        lines: [{ type: "PROSE", content: "x" }],
        position: { page: "abc" },
      }),
    ).rejects.toThrow(/Page must be a whole number/);
  });
});

describe("editQuote", () => {
  async function seedQuote(db: Awaited<ReturnType<typeof createTestDb>>) {
    const work = await createWork(db, { type: "MOVIE", title: "Star Wars", year: 1977 });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    const { slug } = await authorQuote(db, {
      edition: { mode: "existing", id: edition.id },
      lines: [{ type: "DIALOG", content: "Original line.", speaker: "Obi-Wan", subjects: ["Luke"] }],
      position: { start: "1:00:00" },
    });
    const detail = await getQuoteBySlug(db, slug);
    if (!detail) throw new Error("seed failed");
    return { slug, id: detail.id };
  }

  it("replaces line content and re-resolves attributions, keeping the slug", async () => {
    const db = await createTestDb();
    const { id, slug } = await seedQuote(db);

    const result = await editQuote(db, id, {
      lines: [{ type: "DIALOG", content: "The Force will be with you, always.", speaker: "Obi-Wan", subjects: ["Luke"] }],
      position: { start: "1:05:00" },
    });
    expect(result.slug).toBe(slug); // slug is stable across edits

    const detail = await getQuoteById(db, id);
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.lines[0].content).toBe("The Force will be with you, always.");
    expect(detail?.position.startMs).toBe(3_900_000);
    expect(detail?.lines[0].attributions.find((a) => a.role === "SPEAKER")?.characterName).toBe("Obi-Wan");
  });

  it("supports changing the number of lines", async () => {
    const db = await createTestDb();
    const { id } = await seedQuote(db);
    await editQuote(db, id, {
      lines: [
        { type: "DIALOG", content: "First." },
        { type: "DIALOG", content: "Second." },
      ],
    });
    const detail = await getQuoteById(db, id);
    expect(detail?.lines.map((l) => l.content)).toEqual(["First.", "Second."]);
  });

  it("throws (and rolls back) when all lines are blank", async () => {
    const db = await createTestDb();
    const { id } = await seedQuote(db);
    await expect(editQuote(db, id, { lines: [{ type: "DIALOG", content: "   " }] })).rejects.toThrow(/at least one line/);
    const detail = await getQuoteById(db, id);
    expect(detail?.lines[0].content).toBe("Original line."); // unchanged
  });

  it("rejects an out-of-range position for the edition and leaves the quote intact", async () => {
    const db = await createTestDb();
    const { id } = await seedQuote(db);
    await expect(
      editQuote(db, id, { lines: [{ type: "DIALOG", content: "x" }], position: { start: "5:00:00" } }),
    ).rejects.toThrow();
    const detail = await getQuoteById(db, id);
    expect(detail?.lines[0].content).toBe("Original line.");
    expect(detail?.position.startMs).toBe(3_600_000);
  });
});
