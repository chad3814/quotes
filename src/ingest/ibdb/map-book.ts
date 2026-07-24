import type { EditionFormat } from "@/db/schema";
import type { IbdbBook } from "@/ingest/ibdb/types";

const IBDB_BASE = "https://ibdb.dev";

export type MappedBookEdition = {
  isbn13: string;
  format: EditionFormat;
  releaseDate: string | null;
  /** IBDB external reference for the edition (keyed by ISBN). */
  ref: { externalId: string; url: string };
};

export type MappedBook = {
  ibdbId: string;
  work: {
    title: string;
    synopsis: string | null;
    year: number | null;
    byline: string | null;
    posterPath: string | null;
  };
  editions: MappedBookEdition[];
  /** IBDB external reference for the book/work (keyed by IBDB id). */
  workRef: { externalId: string; url: string };
};

const BINDING_FORMATS: Record<string, EditionFormat> = {
  Hardcover: "HARDCOVER",
  Paperback: "PAPERBACK",
  Ebook: "EBOOK",
  Audiobook: "AUDIOBOOK",
};

function bindingToFormat(binding: string): EditionFormat {
  return BINDING_FORMATS[binding] ?? "OTHER";
}

function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapBook(book: IbdbBook): MappedBook {
  const byline = book.authors
    .map((author) => author.name.trim())
    .filter(Boolean)
    .join(", ");

  return {
    ibdbId: book.id,
    work: {
      title: book.title,
      synopsis: nullIfEmpty(book.synopsis),
      year: yearFromDate(book.publicationDate),
      byline: nullIfEmpty(byline),
      posterPath: nullIfEmpty(book.image?.url),
    },
    editions: book.editions
      .filter((edition) => nullIfEmpty(edition.isbn13))
      .map((edition) => ({
        isbn13: edition.isbn13,
        format: bindingToFormat(edition.binding),
        releaseDate: nullIfEmpty(edition.publicationDate),
        ref: { externalId: edition.isbn13, url: `${IBDB_BASE}/isbn/${edition.isbn13}` },
      })),
    workRef: { externalId: book.id, url: `${IBDB_BASE}/book/${book.id}` },
  };
}
