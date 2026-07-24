import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, works } from "@/db/schema";
import { createWork, updateWork } from "@/repositories/works";
import { createEdition, updateEdition } from "@/repositories/editions";

describe("updateWork", () => {
  it("updates metadata fields in place, leaving slug intact", async () => {
    const db = await createTestDb();
    const created = await createWork(db, { type: "MOVIE", title: "Old Title" });
    await updateWork(db, created.id, { title: "New Title", year: 1999, synopsis: "s" });
    const [row] = await db.select().from(works).where(eq(works.id, created.id));
    expect(row.title).toBe("New Title");
    expect(row.year).toBe(1999);
    expect(row.slug).toBe(created.slug);
  });
});

describe("updateEdition", () => {
  it("updates edition fields in place", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "M" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    await updateEdition(db, edition.id, { runtimeMs: 7_260_000, releaseDate: "1977-05-25" });
    const [row] = await db.select().from(editions).where(eq(editions.id, edition.id));
    expect(row.runtimeMs).toBe(7_260_000);
    expect(row.releaseDate).toBe("1977-05-25");
  });
});
