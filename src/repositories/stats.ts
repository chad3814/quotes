import { count } from "drizzle-orm";
import type { Database } from "@/db/types";
import { characters, quotes, works } from "@/db/schema";

export type LibraryStats = {
  works: number;
  quotes: number;
  characters: number;
};

/** Top-line counts for the homepage. */
export async function getLibraryStats(db: Database): Promise<LibraryStats> {
  const [worksRow] = await db.select({ n: count() }).from(works);
  const [quotesRow] = await db.select({ n: count() }).from(quotes);
  const [charactersRow] = await db.select({ n: count() }).from(characters);
  return {
    works: worksRow?.n ?? 0,
    quotes: quotesRow?.n ?? 0,
    characters: charactersRow?.n ?? 0,
  };
}
