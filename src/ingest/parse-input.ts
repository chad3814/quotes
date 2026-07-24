export type TmdbInput = { source: "tmdb"; type: "movie" | "tv"; id: number };
export type IbdbInput = { source: "ibdb"; kind: "isbn" | "book"; value: string };
export type IngestInput = TmdbInput | IbdbInput;

const TMDB_PATTERN = /(?:^|\/)(movie|tv)\/(\d+)/;
const ISBN_PATTERN = /(?:^|\/)isbn\/([^/?#\s]+)/;
const BOOK_PATTERN = /(?:^|\/)book\/([^/?#\s]+)/;

function stripJson(value: string): string {
  return value.replace(/\.json$/i, "");
}

/**
 * Parses an ingest argument into a TMDB (movie/tv) or IBDB (book) target.
 * Accepts bare `movie/ID`, `tv/ID`, `isbn/{isbn13}`, `book/{id}` forms as well
 * as full themoviedb.org / ibdb.dev URLs (with or without a trailing `.json`).
 */
export function parseInput(input: string): IngestInput {
  const trimmed = input.trim();

  const tmdb = TMDB_PATTERN.exec(trimmed);
  if (tmdb) return { source: "tmdb", type: tmdb[1] === "movie" ? "movie" : "tv", id: Number(tmdb[2]) };

  const isbn = ISBN_PATTERN.exec(trimmed);
  if (isbn) return { source: "ibdb", kind: "isbn", value: stripJson(isbn[1]) };

  const book = BOOK_PATTERN.exec(trimmed);
  if (book) return { source: "ibdb", kind: "book", value: stripJson(book[1]) };

  throw new Error(`unrecognized ingest input: ${input}`);
}
