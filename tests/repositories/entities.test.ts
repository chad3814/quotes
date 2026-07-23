import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, works } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";

describe("createWork", () => {
  it("derives a slug from the title", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    expect(work.slug).toBe("a-new-hope");
    const [row] = await db.select().from(works).where(eq(works.id, work.id));
    expect(row.type).toBe("MOVIE");
  });

  it("de-duplicates slugs across works", async () => {
    const db = await createTestDb();
    const first = await createWork(db, { type: "MOVIE", title: "Dune" });
    const second = await createWork(db, { type: "BOOK", title: "Dune" });
    expect(first.slug).toBe("dune");
    expect(second.slug).toBe("dune-2");
  });
});

describe("createEdition", () => {
  it("attaches an edition to a work", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    const [row] = await db.select().from(editions).where(eq(editions.id, edition.id));
    expect(row.workId).toBe(work.id);
    expect(row.runtimeMs).toBe(7_200_000);
  });
});

describe("createCharacter", () => {
  it("derives a slug from the name", async () => {
    const db = await createTestDb();
    const character = await createCharacter(db, { name: "Obi-Wan Kenobi" });
    expect(character.slug).toBe("obi-wan-kenobi");
  });
});
