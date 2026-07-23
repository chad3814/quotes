import { eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import { characters, quotes, works } from "@/db/schema";

const TABLES = { works, characters, quotes };

export async function ensureUniqueSlug(
  db: Database,
  table: "works" | "characters" | "quotes",
  base: string,
): Promise<string> {
  const t = TABLES[table];
  let candidate = base;
  let n = 1;
  for (;;) {
    const existing = await db.select({ id: t.id }).from(t).where(eq(t.slug, candidate)).limit(1);
    if (existing.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}
