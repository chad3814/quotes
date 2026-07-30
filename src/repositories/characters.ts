import { and, asc, countDistinct, eq, inArray, sql } from "drizzle-orm";
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

export type CharacterEditData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  quoteCount: number;
};

/** Loads a character's editable fields plus its distinct quote count (for the admin editor), or null. */
export async function getCharacterEditById(db: Database, id: string): Promise<CharacterEditData | null> {
  const character = await db.query.characters.findFirst({ where: eq(characters.id, id) });
  if (!character) return null;

  const [{ count }] = await db
    .select({ count: countDistinct(quotes.id) })
    .from(attributions)
    .innerJoin(lines, eq(lines.id, attributions.lineId))
    .innerJoin(quotes, eq(quotes.id, lines.quoteId))
    .where(eq(attributions.characterId, id));

  return {
    id: character.id,
    name: character.name,
    slug: character.slug,
    description: character.description,
    quoteCount: count,
  };
}

export type UpdateCharacterFields = {
  name: string;
  description?: string | null;
};

/**
 * Patches a character's editable fields. The slug is intentionally left
 * untouched — a name edit must not break the character's existing URL or links.
 */
export async function updateCharacter(db: Database, id: string, fields: UpdateCharacterFields): Promise<void> {
  await db
    .update(characters)
    .set({ name: fields.name, description: fields.description ?? null, updatedAt: new Date() })
    .where(eq(characters.id, id));
}

/**
 * Deletes a character. Its attributions cascade away (see the schema's
 * onDelete), so any quotes it appeared in survive but lose that speaker/subject.
 */
export async function deleteCharacter(db: Database, id: string): Promise<void> {
  await db.delete(characters).where(eq(characters.id, id));
}

/**
 * Merges the source character into the target: the source's attributions are
 * repointed to the target, then the source is deleted. A source attribution that
 * would collide with one the target already has on the same line + role is
 * dropped instead of repointed — that avoids a duplicate subject on a line and
 * satisfies the one-speaker-per-line unique index. Runs in a transaction and
 * returns the target's id/slug. Throws on a self-merge or a missing character.
 */
export async function mergeCharacters(
  db: Database,
  { sourceId, targetId }: { sourceId: string; targetId: string },
): Promise<{ id: string; slug: string }> {
  if (sourceId === targetId) throw new Error("Can't merge a character into itself.");

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: characters.id, slug: characters.slug })
      .from(characters)
      .where(inArray(characters.id, [sourceId, targetId]));
    const source = found.find((c) => c.id === sourceId);
    const target = found.find((c) => c.id === targetId);
    if (!source || !target) throw new Error("Character not found.");

    // Attributions the target already holds, keyed by line + role.
    const targetAttrs = await tx
      .select({ lineId: attributions.lineId, role: attributions.role })
      .from(attributions)
      .where(eq(attributions.characterId, targetId));
    const targetKeys = new Set(targetAttrs.map((a) => `${a.lineId}:${a.role}`));

    // Drop the source's attributions that would collide; repoint the rest.
    const sourceAttrs = await tx
      .select({ id: attributions.id, lineId: attributions.lineId, role: attributions.role })
      .from(attributions)
      .where(eq(attributions.characterId, sourceId));
    const collidingIds = sourceAttrs.filter((a) => targetKeys.has(`${a.lineId}:${a.role}`)).map((a) => a.id);
    if (collidingIds.length > 0) {
      await tx.delete(attributions).where(inArray(attributions.id, collidingIds));
    }
    await tx.update(attributions).set({ characterId: targetId }).where(eq(attributions.characterId, sourceId));

    await tx.delete(characters).where(eq(characters.id, sourceId));

    return { id: target.id, slug: target.slug };
  });
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
