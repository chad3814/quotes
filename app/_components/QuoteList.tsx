import Link from "next/link";
import type { ReactNode } from "react";

export type QuoteListEntry = {
  slug: string;
  text: string;
  meta?: ReactNode;
  position?: string[];
};

/** Shared quote list used on work and character pages (accent left-rule + serif text). */
export function QuoteList({ quotes }: { quotes: QuoteListEntry[] }) {
  return (
    <ul className="quote-list">
      {quotes.map((quote) => (
        <li key={quote.slug} className="quote-item">
          <Link href={`/quotes/${quote.slug}`} className="quote-item__text">
            {quote.text}
          </Link>
          {(quote.meta || (quote.position && quote.position.length > 0)) && (
            <div className="quote-item__meta">
              {quote.meta}
              {quote.position?.map((chip) => (
                <span key={chip} className="quote-item__pos">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
