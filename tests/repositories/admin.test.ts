import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { characters } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition, listEditionsForAdmin } from "@/repositories/editions";
import { findOrCreateCharacter } from "@/repositories/characters";

describe("findOrCreateCharacter", () => {
  it("creates a character when none matches the name", async () => {
    const db = await createTestDb();
    const created = await findOrCreateCharacter(db, "Gandalf");
    expect(created.slug).toBe("gandalf");
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it("returns the existing character for a matching name (no duplicate)", async () => {
    const db = await createTestDb();
    const first = await findOrCreateCharacter(db, "Gandalf");
    const second = await findOrCreateCharacter(db, "Gandalf");
    expect(second.id).toBe(first.id);
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it("trims the name before matching", async () => {
    const db = await createTestDb();
    const first = await findOrCreateCharacter(db, "Frodo");
    const second = await findOrCreateCharacter(db, "  Frodo  ");
    expect(second.id).toBe(first.id);
  });
});

describe("listEditionsForAdmin", () => {
  it("lists editions with work title/year, ordered by work title", async () => {
    const db = await createTestDb();
    const starWars = await createWork(db, { type: "MOVIE", title: "Star Wars", year: 1977 });
    await createEdition(db, { workId: starWars.id, format: "THEATRICAL" });
    const alien = await createWork(db, { type: "MOVIE", title: "Alien", year: 1979 });
    await createEdition(db, { workId: alien.id, format: "DIRECTORS_CUT", label: "1979 Cut" });

    const options = await listEditionsForAdmin(db);
    expect(options.map((option) => option.workTitle)).toEqual(["Alien", "Star Wars"]);
    expect(options[0]).toMatchObject({ format: "DIRECTORS_CUT", label: "1979 Cut", workYear: 1979 });
  });

  it("returns an empty array when there are no editions", async () => {
    const db = await createTestDb();
    expect(await listEditionsForAdmin(db)).toEqual([]);
  });
});
