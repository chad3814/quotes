import { sql } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { WorkType } from "@/db/schema";
import { HL_END, HL_START } from "@/lib/highlight";

// Custom highlight delimiters that survive HTML-escaping and cannot collide with
// literal markup inside a quote (see src/lib/highlight.ts).
const HEADLINE_OPTIONS = `StartSel=${HL_START}, StopSel=${HL_END}`;

export type SearchResult = {
  id: string;
  slug: string;
  /** ts_headline output containing <b>…</b> around the matched terms. */
  headline: string;
  rank: number;
  work: { title: string; slug: string; type: WorkType; year: number | null };
};

type RawSearchRow = {
  id: string;
  slug: string;
  headline: string;
  rank: number;
  work_title: string;
  work_slug: string;
  work_type: WorkType;
  work_year: number | null;
};

export async function searchQuotes(db: Database, query: string, limit = 20): Promise<SearchResult[]> {
  const result = (await db.execute(sql`
    select
      q.id as id,
      q.slug as slug,
      ts_headline('english', q.search_text, websearch_to_tsquery('english', ${query}), ${HEADLINE_OPTIONS}) as headline,
      ts_rank(q.search_vector, websearch_to_tsquery('english', ${query})) as rank,
      w.title as work_title,
      w.slug as work_slug,
      w.type as work_type,
      w.year as work_year
    from quotes q
    join editions e on e.id = q.edition_id
    join works w on w.id = e.work_id
    where q.search_vector @@ websearch_to_tsquery('english', ${query})
    order by rank desc
    limit ${limit}
  `)) as { rows: RawSearchRow[] };

  return result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    headline: String(row.headline),
    rank: Number(row.rank),
    work: {
      title: String(row.work_title),
      slug: String(row.work_slug),
      type: row.work_type,
      year: row.work_year == null ? null : Number(row.work_year),
    },
  }));
}
