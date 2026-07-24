import { describe, expect, it } from "vitest";
import { mapBook } from "@/ingest/ibdb/map-book";
import type { IbdbBook } from "@/ingest/ibdb/types";

const BOOK: IbdbBook = {
  id: "03ba0b4d",
  title: "Dungeon Crawler Carl",
  synopsis: "  A tale.  ",
  publicationDate: "2024-08-27",
  image: { url: "https://images.isbndb.com/covers/1.jpg" },
  authors: [
    { id: "a1", name: "Matt Dinniman" },
    { id: "a2", name: "Someone Else" },
  ],
  editions: [
    { id: "e1", isbn13: "9780593820247", binding: "Hardcover", publicationDate: "2024-08-27" },
    { id: "e2", isbn13: "9781234567890", binding: "Audiobook", publicationDate: null },
    { id: "e3", isbn13: "", binding: "Ebook" }, // no ISBN → dropped
    { id: "e4", isbn13: "9789999999999", binding: "Zine" }, // unknown binding → OTHER
  ],
};

describe("mapBook", () => {
  it("maps work fields (byline, year, trimmed synopsis, cover, ref)", () => {
    const mapped = mapBook(BOOK);
    expect(mapped.ibdbId).toBe("03ba0b4d");
    expect(mapped.work.title).toBe("Dungeon Crawler Carl");
    expect(mapped.work.year).toBe(2024);
    expect(mapped.work.synopsis).toBe("A tale.");
    expect(mapped.work.byline).toBe("Matt Dinniman, Someone Else");
    expect(mapped.work.posterPath).toBe("https://images.isbndb.com/covers/1.jpg");
    expect(mapped.workRef).toEqual({ externalId: "03ba0b4d", url: "https://ibdb.dev/book/03ba0b4d" });
  });

  it("maps editions (binding→format), drops ISBN-less ones, builds edition refs", () => {
    const mapped = mapBook(BOOK);
    expect(mapped.editions.map((e) => [e.isbn13, e.format])).toEqual([
      ["9780593820247", "HARDCOVER"],
      ["9781234567890", "AUDIOBOOK"],
      ["9789999999999", "OTHER"],
    ]);
    expect(mapped.editions[0].releaseDate).toBe("2024-08-27");
    expect(mapped.editions[1].releaseDate).toBeNull();
    expect(mapped.editions[0].ref).toEqual({
      externalId: "9780593820247",
      url: "https://ibdb.dev/isbn/9780593820247",
    });
  });

  it("handles a book with no authors, cover, or date", () => {
    const mapped = mapBook({ ...BOOK, authors: [], image: null, publicationDate: null });
    expect(mapped.work.byline).toBeNull();
    expect(mapped.work.posterPath).toBeNull();
    expect(mapped.work.year).toBeNull();
  });
});
