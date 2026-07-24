import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork, getWorkBySlug, listWorks } from "@/repositories/works";

async function seedSeries(db: Awaited<ReturnType<typeof createTestDb>>, episodeCount: number) {
  const series = await createWork(db, { type: "TV_SERIES", title: "Long Runner" });
  for (let i = 1; i <= episodeCount; i += 1) {
    await createWork(db, {
      type: "TV_EPISODE",
      title: `Episode ${i}`,
      parentWorkId: series.id,
      seasonNumber: 1,
      episodeNumber: i,
    });
  }
  return series;
}

describe("listWorks limit handling", () => {
  it("returns all children when limit is null — guards the >500 truncation bug", async () => {
    const db = await createTestDb();
    const series = await seedSeries(db, 6);
    const all = await listWorks(db, { parentId: series.id, limit: null });
    expect(all).toHaveLength(6);
  });

  it("respects an explicit limit", async () => {
    const db = await createTestDb();
    const series = await seedSeries(db, 6);
    expect(await listWorks(db, { parentId: series.id, limit: 2 })).toHaveLength(2);
  });

  it("getWorkBySlug returns every episode of a series (not capped)", async () => {
    const db = await createTestDb();
    const series = await seedSeries(db, 6);
    const page = await getWorkBySlug(db, series.slug);
    expect(page?.children).toHaveLength(6);
    expect(page?.children.every((child) => child.seasonNumber === 1)).toBe(true);
  });
});
