import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork, getWorkBySlug } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createQuote } from "@/repositories/quotes";

describe("getWorkBySlug", () => {
  it("returns the work with its editions and their quotes", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope", year: 1977 });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "Use the Force, Luke." }] });

    const page = await getWorkBySlug(db, work.slug);
    expect(page?.title).toBe("A New Hope");
    expect(page?.year).toBe(1977);
    expect(page?.editions).toHaveLength(1);
    expect(page?.editions[0].quotes).toHaveLength(1);
    expect(page?.editions[0].quotes[0].preview).toContain("Use the Force");
  });

  it("returns null for an unknown work", async () => {
    const db = await createTestDb();
    expect(await getWorkBySlug(db, "nope")).toBeNull();
  });
});
