import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import {
  createCharacter,
  deleteCharacter,
  getCharacterEditById,
  getCharacterPageBySlug,
  updateCharacter,
} from "@/repositories/characters";
import { createQuote, getQuoteBySlug } from "@/repositories/quotes";

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

describe("getCharacterEditById", () => {
  it("returns editable fields with the distinct quote count", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    const luke = await createCharacter(db, { name: "Luke Skywalker", description: "Farm boy." });
    // Appears in two lines of the SAME quote → counted once (distinct quotes).
    await createQuote(db, {
      editionId: edition.id,
      lines: [
        { type: "DIALOG", content: "But I was going to Tosche Station.", attributions: [{ characterId: luke.id, role: "SPEAKER" }] },
        { type: "DIALOG", content: "It's not fair.", attributions: [{ characterId: luke.id, role: "SPEAKER" }] },
      ],
    });

    const data = await getCharacterEditById(db, luke.id);
    expect(data?.name).toBe("Luke Skywalker");
    expect(data?.description).toBe("Farm boy.");
    expect(data?.quoteCount).toBe(1);
  });

  it("returns null for an unknown id", async () => {
    const db = await createTestDb();
    expect(await getCharacterEditById(db, "missing")).toBeNull();
  });
});

describe("updateCharacter", () => {
  it("patches name and description but leaves the slug untouched", async () => {
    const db = await createTestDb();
    const character = await createCharacter(db, { name: "Leia" });
    await updateCharacter(db, character.id, { name: "Princess Leia Organa", description: "Rebel leader." });

    const data = await getCharacterEditById(db, character.id);
    expect(data?.name).toBe("Princess Leia Organa");
    expect(data?.description).toBe("Rebel leader.");
    expect(data?.slug).toBe(character.slug); // slug is stable across edits
  });

  it("clears the description when passed null", async () => {
    const db = await createTestDb();
    const character = await createCharacter(db, { name: "Han", description: "Smuggler." });
    await updateCharacter(db, character.id, { name: "Han Solo", description: null });
    expect((await getCharacterEditById(db, character.id))?.description).toBeNull();
  });
});

describe("deleteCharacter", () => {
  it("removes the character and its attributions but keeps the quote", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
    const { slug } = await createQuote(db, {
      editionId: edition.id,
      lines: [{ type: "DIALOG", content: "Hello there.", attributions: [{ characterId: obiwan.id, role: "SPEAKER" }] }],
    });

    await deleteCharacter(db, obiwan.id);

    expect(await getCharacterEditById(db, obiwan.id)).toBeNull();
    const quote = await getQuoteBySlug(db, slug);
    expect(quote?.lines[0].content).toBe("Hello there."); // quote survives
    expect(quote?.lines[0].attributions).toHaveLength(0); // attribution cascaded away
  });
});
