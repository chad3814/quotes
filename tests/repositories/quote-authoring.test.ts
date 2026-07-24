import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { characters, editions, quotes, works } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";
import { getQuoteBySlug } from "@/repositories/quotes";
import { authorQuote } from "@/repositories/quote-authoring";

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
