import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listRecentQuotes } from "@/repositories/quotes";
import { getLibraryStats } from "@/repositories/stats";
import { pluralize } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const db = getDb();
  const [stats, recent] = await Promise.all([getLibraryStats(db), listRecentQuotes(db, 5)]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle tnum">
          {pluralize(stats.works, "work")} · {pluralize(stats.quotes, "quote")} · {pluralize(stats.characters, "character")}
        </p>
      </div>

      <div className="admin-form__actions">
        <Link href="/admin/quotes/new" className="btn-primary admin-cta">
          + Add a quote
        </Link>
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="section-label">Recently added</h2>
          <div className="rows">
            {recent.map((quote) => (
              <div key={quote.slug} className="quote-row">
                <Link href={`/quotes/${quote.slug}`} className="quote-row__link">
                  <span className="quote-row__snippet">{quote.preview}</span>
                  <span className="quote-row__meta">
                    <span className="quote-row__work">{quote.work.title}</span>
                    {quote.work.year ? <span className="tnum"> ({quote.work.year})</span> : null}
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
