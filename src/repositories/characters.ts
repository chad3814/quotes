import { and, asc, countDistinct, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { AttributionRole } from "@/db/schema";
import { attributions, characters, lines, quotes } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { quotePreview } from "@/lib/preview";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateCharacterInput = {
  name: string;
  description?: string;
  slug?: string;
};

export async function createCharacter(
  db: Database,
  input: CreateCharacterInput,
): Promise<{ id: string; slug: string }> {
  const slug = await ensureUniqueSlug(db, "characters", input.slug ?? slugify(input.name));
  const [row] = await db
    .insert(characters)
    .values({ name: input.name, description: input.description ?? null, slug })
    .returning({ id: characters.id, slug: characters.slug });
  return row;
}

/**
 * Returns the id/slug of the character whose name matches (case-insensitively,
 * ignoring surrounding whitespace), creating one if none exists. Matching is
 * case-insensitive so a typed "obi-wan" doesn't duplicate an existing "Obi-Wan".
 * When several characters share a name, the oldest is reused deterministically.
 * Used by the admin quote authoring flow where a new speaker/subject is entered
 * by name rather than picked from the existing list.
 */
export async function findOrCreateCharacter(db: Database, name: string): Promise<{ id: string; slug: string }> {
  const trimmed = name.trim();
  const existing = await db
    .select({ id: characters.id, slug: characters.slug })
    .from(characters)
    .where(sql`lower(${characters.name}) = ${trimmed.toLowerCase()}`)
    .orderBy(asc(characters.createdAt), asc(characters.id))
    .limit(1);
  if (existing.length > 0) return existing[0];
  return createCharacter(db, { name: trimmed });
}

export type QuoteSummary = { id: string; slug: string; preview: string };

export type CharacterListItem = {
  id: string;
  name: string;
  slug: string;
  quoteCount: number;
};

/** Lists characters with a count of the distinct quotes they appear in (any role). */
export async function listCharacters(
  db: Database,
  options: { limit?: number; offset?: number } = {},
): Promise<CharacterListItem[]> {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      slug: characters.slug,
      quoteCount: countDistinct(quotes.id),
    })
    .from(characters)
    .leftJoin(attributions, eq(attributions.characterId, characters.id))
    .leftJoin(lines, eq(lines.id, attributions.lineId))
    .leftJoin(quotes, eq(quotes.id, lines.quoteId))
    .groupBy(characters.id)
    .orderBy(asc(characters.name))
    .limit(options.limit ?? 500)
    .offset(options.offset ?? 0);
}

export type CharacterPage = {
  character: { id: string; name: string; slug: string; description: string | null };
  asSpeaker: QuoteSummary[];
  asSubject: QuoteSummary[];
};

export async function getCharacterPageBySlug(db: Database, slug: string): Promise<CharacterPage | null> {
  const character = await db.query.characters.findFirst({ where: eq(characters.slug, slug) });
  if (!character) return null;

  const quotesForRole = async (role: AttributionRole): Promise<QuoteSummary[]> => {
    const rows = await db
      .selectDistinct({
        id: quotes.id,
        slug: quotes.slug,
        searchText: quotes.searchText,
        createdAt: quotes.createdAt,
      })
      .from(attributions)
      .innerJoin(lines, eq(attributions.lineId, lines.id))
      .innerJoin(quotes, eq(lines.quoteId, quotes.id))
      .where(and(eq(attributions.characterId, character.id), eq(attributions.role, role)))
      .orderBy(asc(quotes.createdAt), asc(quotes.id));
    return rows.map((row) => ({ id: row.id, slug: row.slug, preview: quotePreview(row.searchText) }));
  };

  return {
    character: {
      id: character.id,
      name: character.name,
      slug: character.slug,
      description: character.description,
    },
    asSpeaker: await quotesForRole("SPEAKER"),
    asSubject: await quotesForRole("SUBJECT"),
  };
}
