import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createQuote } from "@/repositories/quotes";
import { searchQuotes } from "@/repositories/search";

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
  const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
  await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "Use the Force, Luke." }] });
  await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "I have a bad feeling about this." }] });
}

describe("searchQuotes", () => {
  it("matches on content and returns a highlighted headline", async () => {
    const db = await createTestDb();
    await seed(db);
    const results = await searchQuotes(db, "force");
    expect(results).toHaveLength(1);
    expect(results[0].headline.toLowerCase()).toContain("<b>force</b>");
    expect(results[0].rank).toBeGreaterThan(0);
  });

  it("returns nothing for a non-matching query", async () => {
    const db = await createTestDb();
    await seed(db);
    expect(await searchQuotes(db, "wookiee")).toHaveLength(0);
  });
});
