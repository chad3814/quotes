import type { QuoteDetail } from "@/repositories/quotes";

/**
 * The public JSON representation of a quote, returned by the /api/quotes routes.
 * Attributions are reshaped from the flat DB rows into a per-line speaker +
 * subjects structure, and site URLs are absolutised against the request origin.
 */
export type QuoteJson = ReturnType<typeof serializeQuote>;

function serializeLine(line: QuoteDetail["lines"][number]) {
  const speaker = line.attributions.find((attr) => attr.role === "SPEAKER");
  const subjects = line.attributions.filter((attr) => attr.role === "SUBJECT");
  return {
    ordinal: line.ordinal,
    type: line.type,
    content: line.content,
    speaker: speaker
      ? { id: speaker.characterId, name: speaker.characterName, slug: speaker.characterSlug }
      : null,
    subjects: subjects.map((subject) => ({
      id: subject.characterId,
      name: subject.characterName,
      slug: subject.characterSlug,
      start: subject.start,
      end: subject.end,
    })),
  };
}

export function serializeQuote(quote: QuoteDetail, origin: string) {
  const { work, edition } = quote.source;
  return {
    id: quote.id,
    slug: quote.slug,
    url: `${origin}/quotes/${quote.slug}`,
    work: {
      id: work.id,
      title: work.title,
      slug: work.slug,
      type: work.type,
      year: work.year,
      url: `${origin}/works/${work.slug}`,
    },
    edition: {
      id: edition.id,
      format: edition.format,
      label: edition.label,
    },
    position: quote.position,
    lines: quote.lines.map(serializeLine),
  };
}
