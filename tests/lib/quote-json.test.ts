import { describe, expect, it } from "vitest";
import { serializeQuote } from "@/lib/quote-json";
import type { QuoteDetail } from "@/repositories/quotes";

const quote: QuoteDetail = {
  id: "q1",
  slug: "use-the-force-luke",
  position: { startMs: 3_600_000, endMs: null, chapter: null, page: null, percent: null, locationNote: null },
  source: {
    work: { id: "w1", title: "Star Wars", slug: "star-wars", type: "MOVIE", year: 1977 },
    edition: { id: "e1", format: "THEATRICAL", label: null },
  },
  lines: [
    {
      ordinal: 0,
      type: "DIALOG",
      content: "Use the Force, Luke.",
      attributions: [
        { characterId: "c1", characterName: "Obi-Wan Kenobi", characterSlug: "obi-wan-kenobi", role: "SPEAKER", start: null, end: null },
        { characterId: "c2", characterName: "Luke Skywalker", characterSlug: "luke-skywalker", role: "SUBJECT", start: 15, end: 19 },
      ],
    },
    {
      ordinal: 1,
      type: "STAGE_DIRECTION",
      content: "(the Force hums)",
      attributions: [],
    },
  ],
};

describe("serializeQuote", () => {
  it("absolutises site URLs against the origin", () => {
    const json = serializeQuote(quote, "https://tqdb.org");
    expect(json.url).toBe("https://tqdb.org/quotes/use-the-force-luke");
    expect(json.work.url).toBe("https://tqdb.org/works/star-wars");
  });

  it("reshapes attributions into a per-line speaker + subjects", () => {
    const json = serializeQuote(quote, "https://tqdb.org");
    expect(json.lines[0].speaker).toEqual({ id: "c1", name: "Obi-Wan Kenobi", slug: "obi-wan-kenobi" });
    expect(json.lines[0].subjects).toEqual([
      { id: "c2", name: "Luke Skywalker", slug: "luke-skywalker", start: 15, end: 19 },
    ]);
  });

  it("returns a null speaker and empty subjects for a line without attributions", () => {
    const json = serializeQuote(quote, "https://tqdb.org");
    expect(json.lines[1].speaker).toBeNull();
    expect(json.lines[1].subjects).toEqual([]);
  });

  it("carries id, slug, edition, and position through", () => {
    const json = serializeQuote(quote, "https://tqdb.org");
    expect(json.id).toBe("q1");
    expect(json.slug).toBe("use-the-force-luke");
    expect(json.edition).toEqual({ id: "e1", format: "THEATRICAL", label: null });
    expect(json.position.startMs).toBe(3_600_000);
  });
});
