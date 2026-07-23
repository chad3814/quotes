import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter, getCharacterPageBySlug } from "@/repositories/characters";
import { createQuote } from "@/repositories/quotes";

describe("getCharacterPageBySlug", () => {
  it("groups quotes by speaker vs subject", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
    const luke = await createCharacter(db, { name: "Luke Skywalker" });

    await createQuote(db, {
      editionId: edition.id,
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    await createQuote(db, {
      editionId: edition.id,
      lines: [{ type: "DIALOG", content: "I'll try.", attributions: [{ characterId: luke.id, role: "SPEAKER" }] }],
    });

    const page = await getCharacterPageBySlug(db, luke.slug);
    expect(page?.character.name).toBe("Luke Skywalker");
    expect(page?.asSpeaker).toHaveLength(1);
    expect(page?.asSubject).toHaveLength(1);
    expect(page?.asSpeaker[0].preview).toContain("I'll try.");
  });

  it("returns null for an unknown character", async () => {
    const db = await createTestDb();
    expect(await getCharacterPageBySlug(db, "nobody")).toBeNull();
  });
});
