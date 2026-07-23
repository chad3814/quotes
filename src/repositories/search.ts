import { sql } from "drizzle-orm";
import type { Database } from "@/db/types";

export type SearchResult = {
  id: string;
  slug: string;
  headline: string;
  rank: number;
};

export async function searchQuotes(db: Database, query: string, limit = 20): Promise<SearchResult[]> {
  const result = (await db.execute(sql`
    select
      q.id as id,
      q.slug as slug,
      ts_headline('english', q.search_text, websearch_to_tsquery('english', ${query})) as headline,
      ts_rank(q.search_vector, websearch_to_tsquery('english', ${query})) as rank
    from quotes q
    where q.search_vector @@ websearch_to_tsquery('english', ${query})
    order by rank desc
    limit ${limit}
  `)) as { rows: SearchResult[] };

  return result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    headline: String(row.headline),
    rank: Number(row.rank),
  }));
}
