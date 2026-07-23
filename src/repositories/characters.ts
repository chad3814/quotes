import type { Database } from "@/db/types";
import { characters } from "@/db/schema";
import { slugify } from "@/lib/slug";
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
