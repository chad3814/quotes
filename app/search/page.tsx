import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { searchQuotes } from "@/repositories/search";
import { renderHeadline } from "@/lib/highlight";
import { pluralize } from "@/lib/format";
import { SearchInput } from "../_components/SearchInput";

export const dynamic = "force-dynamic";

const RESULT_LIMIT = 40;

// searchParams values are `string | string[]` at runtime (repeated ?q=… yields an array).
type SearchParams = Promise<{ q?: string | string[] }>;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const query = firstParam((await searchParams).q);
  return { title: query ? `“${query}”` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const query = firstParam((await searchParams).q);

  if (!query) {
    return (
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Search</h1>
          <p className="page-subtitle">Find a quote by any word or phrase it contains.</p>
        </div>
        <SearchInput variant="hero" defaultValue="" autoFocus />
      </div>
    );
  }

  const db = getDb();
  const results = await searchQuotes(db, query, RESULT_LIMIT + 1);
  const capped = results.length > RESULT_LIMIT;
  const shown = capped ? results.slice(0, RESULT_LIMIT) : results;
  const countLabel = capped ? `${RESULT_LIMIT}+ results` : pluralize(shown.length, "result");

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle tnum">
          {countLabel} for “{query}”
        </p>
      </div>

      <SearchInput variant="hero" defaultValue={query} />
      <hr className="hairline" />

      {shown.length === 0 ? (
        <div className="empty">
          <p>No quotes match “{query}”.</p>
          <p className="empty__hint">Try a shorter phrase or a single distinctive word.</p>
        </div>
      ) : (
        <div className="rows">
          {shown.map((result) => (
            <div key={result.id} className="quote-row">
              <Link href={`/quotes/${result.slug}`} className="quote-row__link">
                <span
                  className="quote-row__snippet"
                  dangerouslySetInnerHTML={{ __html: renderHeadline(result.headline) }}
                />
                <span className="quote-row__meta">
                  <span className="quote-row__work">{result.work.title}</span>
                  {result.work.year ? <span className="tnum"> ({result.work.year})</span> : null}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
