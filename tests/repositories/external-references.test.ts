import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { findEntityIdByRef, upsertExternalReference } from "@/repositories/external-references";

describe("external references", () => {
  it("returns null when no ref exists", async () => {
    const db = await createTestDb();
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBeNull();
  });

  it("inserts then finds a ref", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://x" });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("work-1");
  });

  it("upserts (no duplicate) and updates url/entityId on conflict", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://old" });
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://new" });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("work-1");
  });

  it("distinguishes WORK vs EDITION refs sharing an external id", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "w", provider: "TMDB", externalId: "11", url: null });
    await upsertExternalReference(db, { entityType: "EDITION", entityId: "e", provider: "TMDB", externalId: "11", url: null });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("w");
    expect(await findEntityIdByRef(db, "EDITION", "TMDB", "11")).toBe("e");
  });
});
