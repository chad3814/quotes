import Link from "next/link";
import { getDb } from "@/db/client";
import { getRandomQuote, listRecentQuotes } from "@/repositories/quotes";
import { listCharacters } from "@/repositories/characters";
import { getLibraryStats } from "@/repositories/stats";
import { pluralize } from "@/lib/format";
import { SearchInput } from "./_components/SearchInput";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = getDb();
  const [stats, featured, recent, characters] = await Promise.all([
    getLibraryStats(db),
    getRandomQuote(db),
    listRecentQuotes(db, 12),
    listCharacters(db, { limit: 8 }),
  ]);

  return (
    <div className="wide home">
      <div className="home__hero">
        <h1 className="sr-only">TQDb — The Quote Database</h1>
        <p className="eyebrow">A quote archive</p>
        {featured ? (
          <>
            <Link href={`/quotes/${featured.slug}`} className="home__quote-link">
              <p className="home__quote">{featured.text}</p>
            </Link>
            <p className="home__quote-cite">
              <Link href={`/works/${featured.work.slug}`}>
                {featured.work.title}
                {featured.work.year ? ` (${featured.work.year})` : ""}
              </Link>
            </p>
          </>
        ) : (
          <p className="home__quote">A typeset database of quotations.</p>
        )}

        <div className="home__search">
          <SearchInput variant="hero" />
        </div>

        <div className="stat-row">
          <span className="stat">
            <Link href="/works">
              <span className="stat__value tnum">{stats.works}</span> Works
            </Link>
          </span>
          <span className="stat">
            <Link href="/characters">
              <span className="stat__value tnum">{stats.characters}</span> Characters
            </Link>
          </span>
          <span className="stat">
            <span className="stat__value tnum">{stats.quotes}</span> Quotes
          </span>
        </div>
      </div>

      {recent.length > 0 && (
        <section className="home__section">
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

      {characters.length > 0 && (
        <section className="home__section">
          <h2 className="section-label">Browse characters</h2>
          <div className="rows">
            {characters.map((character) => (
              <div key={character.slug} className="row">
                <Link href={`/characters/${character.slug}`} className="row-link">
                  <span className="row__title">{character.name}</span>
                  <span className="row__meta tnum">{pluralize(character.quoteCount, "quote")}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
