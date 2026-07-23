import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { characters } from "@/db/schema";
import { ensureUniqueSlug } from "@/repositories/slug-util";

describe("ensureUniqueSlug", () => {
  it("returns the base when unused", async () => {
    const db = await createTestDb();
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker");
  });

  it("appends an incrementing suffix on collision", async () => {
    const db = await createTestDb();
    await db.insert(characters).values({ name: "Luke", slug: "luke-skywalker" });
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker-2");
    await db.insert(characters).values({ name: "Luke 2", slug: "luke-skywalker-2" });
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker-3");
  });
});
