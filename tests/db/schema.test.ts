import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { attributions, characters, editions, lines, quotes, works } from "@/db/schema";

function sqlMatch() {
  return sql`${quotes.searchVector} @@ websearch_to_tsquery('english', 'force')`;
}

async function seedLine(db: Awaited<ReturnType<typeof createTestDb>>) {
  const [work] = await db.insert(works).values({ type: "MOVIE", title: "Star Wars", slug: "star-wars" }).returning();
  const [edition] = await db.insert(editions).values({ workId: work.id, format: "THEATRICAL" }).returning();
  const [quote] = await db
    .insert(quotes)
    .values({ editionId: edition.id, slug: "use-the-force-abcd1234", searchText: "Use the Force, Luke. Let go." })
    .returning();
  const [line] = await db
    .insert(lines)
    .values({ quoteId: quote.id, ordinal: 0, type: "DIALOG", content: "Use the Force, Luke. Let go." })
    .returning();
  return { work, edition, quote, line };
}

describe("schema", () => {
  it("populates the generated tsvector so search matches", async () => {
    const db = await createTestDb();
    const { quote } = await seedLine(db);
    const hits = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, quote.id), sqlMatch()));
    expect(hits).toHaveLength(1);
  });

  it("enforces at most one SPEAKER attribution per line", async () => {
    const db = await createTestDb();
    const { line } = await seedLine(db);
    const [obiwan] = await db.insert(characters).values({ name: "Obi-Wan Kenobi", slug: "obi-wan-kenobi" }).returning();
    const [luke] = await db.insert(characters).values({ name: "Luke Skywalker", slug: "luke-skywalker" }).returning();
    await db.insert(attributions).values({ lineId: line.id, characterId: obiwan.id, role: "SPEAKER" });
    await expect(
      db.insert(attributions).values({ lineId: line.id, characterId: luke.id, role: "SPEAKER" }),
    ).rejects.toThrow();
  });

  it("allows multiple SUBJECT attributions per line", async () => {
    const db = await createTestDb();
    const { line } = await seedLine(db);
    const [a] = await db.insert(characters).values({ name: "A", slug: "a" }).returning();
    const [b] = await db.insert(characters).values({ name: "B", slug: "b" }).returning();
    await db.insert(attributions).values({ lineId: line.id, characterId: a.id, role: "SUBJECT", start: 15, end: 19 });
    await db.insert(attributions).values({ lineId: line.id, characterId: b.id, role: "SUBJECT" });
    const rows = await db.select().from(attributions).where(eq(attributions.lineId, line.id));
    expect(rows).toHaveLength(2);
  });
});
