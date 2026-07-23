import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { lines, quotes } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";
import { createQuote, getQuoteBySlug } from "@/repositories/quotes";

async function arrange(db: Awaited<ReturnType<typeof createTestDb>>) {
  const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
  const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
  const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
  const luke = await createCharacter(db, { name: "Luke Skywalker" });
  return { edition, obiwan, luke };
}

describe("createQuote", () => {
  it("creates a quote with lines, attributions, slug, and search text", async () => {
    const db = await createTestDb();
    const { edition, obiwan, luke } = await arrange(db);
    const created = await createQuote(db, {
      editionId: edition.id,
      position: { startMs: 5000 },
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke. Let go.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    expect(created.slug).toBe("use-the-force-luke-let-go");
    const [row] = await db.select().from(quotes).where(eq(quotes.id, created.id));
    expect(row.searchText).toBe("Use the Force, Luke. Let go.");
    expect(row.startMs).toBe(5000);
  });

  it("rejects an invalid subject span", async () => {
    const db = await createTestDb();
    const { edition, luke } = await arrange(db);
    await expect(
      createQuote(db, {
        editionId: edition.id,
        lines: [{ type: "DIALOG", content: "short", attributions: [{ characterId: luke.id, role: "SUBJECT", start: 1, end: 99 }] }],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(quotes)).toHaveLength(0);
  });

  it("rejects a position that is invalid for the edition", async () => {
    const db = await createTestDb();
    const { edition } = await arrange(db);
    await expect(
      createQuote(db, {
        editionId: edition.id,
        position: { startMs: 9_000_000 },
        lines: [{ type: "DIALOG", content: "Use the Force." }],
      }),
    ).rejects.toThrow();
  });

  it("rolls back the transaction when a mid-transaction insert fails", async () => {
    const db = await createTestDb();
    const { edition, obiwan, luke } = await arrange(db);
    await expect(
      createQuote(db, {
        editionId: edition.id,
        lines: [
          {
            type: "DIALOG",
            content: "Use the Force, Luke. Let go.",
            attributions: [
              { characterId: obiwan.id, role: "SPEAKER" },
              { characterId: luke.id, role: "SPEAKER" },
            ],
          },
        ],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(quotes)).toHaveLength(0);
    expect(await db.select().from(lines)).toHaveLength(0);
  });
});

describe("getQuoteBySlug", () => {
  it("returns the quote with ordered lines and resolved attributions", async () => {
    const db = await createTestDb();
    const { edition, obiwan, luke } = await arrange(db);
    const created = await createQuote(db, {
      editionId: edition.id,
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke. Let go.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    const detail = await getQuoteBySlug(db, created.slug);
    expect(detail).not.toBeNull();
    expect(detail?.lines).toHaveLength(1);
    const subject = detail?.lines[0].attributions.find((a) => a.role === "SUBJECT");
    expect(subject?.characterName).toBe("Luke Skywalker");
    expect(subject?.start).toBe(15);
  });

  it("returns null for an unknown slug", async () => {
    const db = await createTestDb();
    expect(await getQuoteBySlug(db, "nope")).toBeNull();
  });
});
