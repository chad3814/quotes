import { and, asc, eq } from "drizzle-orm";
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

export type QuoteSummary = { id: string; slug: string; preview: string };

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
