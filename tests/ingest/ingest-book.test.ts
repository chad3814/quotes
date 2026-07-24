import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, externalReferences, works } from "@/db/schema";
import { ingestBook } from "@/ingest/ingest-book";
import type { IbdbBook, IbdbClient } from "@/ingest/ibdb/types";

const BOOK: IbdbBook = {
  id: "b-uuid",
  title: "Dungeon Crawler Carl",
  synopsis: "A tale.",
  publicationDate: "2024-08-27",
  image: { url: "https://images.isbndb.com/covers/1.jpg" },
  authors: [{ id: "a1", name: "Matt Dinniman" }],
  editions: [
    { id: "e1", isbn13: "9780593820247", binding: "Hardcover" },
    { id: "e2", isbn13: "9798588333764", binding: "Paperback" },
  ],
};

function mockClient(book: IbdbBook): IbdbClient {
  return { getBookByIsbn: async () => book, getBookById: async () => book };
}

describe("ingestBook", () => {
  it("creates a BOOK work (byline + cover) and its editions with IBDB refs", async () => {
    const db = await createTestDb();
    const summary = await ingestBook(db, mockClient(BOOK), { source: "ibdb", kind: "book", value: "b-uuid" });
    expect(summary.workCreated).toBe(true);
    expect(summary.editionsCreated).toBe(2);

    const [work] = await db.select().from(works).where(eq(works.id, summary.workId));
    expect(work.type).toBe("BOOK");
    expect(work.title).toBe("Dungeon Crawler Carl");
    expect(work.byline).toBe("Matt Dinniman");
    expect(work.posterPath).toBe("https://images.isbndb.com/covers/1.jpg");
    expect(work.year).toBe(2024);

    const eds = await db.select().from(editions).where(eq(editions.workId, summary.workId));
    expect(eds.map((e) => e.format).sort()).toEqual(["HARDCOVER", "PAPERBACK"]);

    const refs = await db.select().from(externalReferences);
    expect(refs.filter((r) => r.entityType === "WORK" && r.externalId === "b-uuid")).toHaveLength(1);
    expect(
      refs
        .filter((r) => r.entityType === "EDITION")
        .map((r) => r.externalId)
        .sort(),
    ).toEqual(["9780593820247", "9798588333764"]);
  });

  it("is idempotent — re-ingesting updates in place, no duplicates", async () => {
    const db = await createTestDb();
    const input = { source: "ibdb", kind: "isbn", value: "9780593820247" } as const;
    const first = await ingestBook(db, mockClient(BOOK), input);
    const second = await ingestBook(db, mockClient(BOOK), input);

    expect(second.workCreated).toBe(false);
    expect(second.workId).toBe(first.workId);
    expect(second.editionsCreated).toBe(0);
    expect(second.editionsExisting).toBe(2);
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(2);
  });
});
