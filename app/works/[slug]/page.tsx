import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkBySlug } from "@/repositories/works";
import { editionFormatLabel, episodeCode, pluralize, workTypeLabel } from "@/lib/format";
import { QuoteList } from "../../_components/QuoteList";
import { WorkPoster } from "../../_components/WorkPoster";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

// Deduplicate the DB read shared by generateMetadata and the page (one query/request).
const loadWork = cache((slug: string) => getWorkBySlug(getDb(), slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const work = await loadWork(slug);
  return { title: work?.title ?? "Work" };
}

export default async function WorkPage({ params }: { params: Params }) {
  const { slug } = await params;
  const work = await loadWork(slug);
  if (!work) notFound();

  const code = episodeCode(work.seasonNumber, work.episodeNumber);
  const quotes = work.editions.flatMap((edition) =>
    edition.quotes.map((quote) => ({ ...quote, editionFormat: edition.format })),
  );
  const totalQuotes = quotes.length;
  const multipleEditions = work.editions.length > 1;

  const subtitleParts = [workTypeLabel(work.type)];
  if (code) subtitleParts.push(code);
  if (work.year) subtitleParts.push(String(work.year));
  subtitleParts.push(pluralize(totalQuotes, "quote"));

  return (
    <div className="work-layout">
      <WorkPoster posterPath={work.posterPath} title={work.title} type={work.type} />
      <div className="container">
      <div className="page-header">
        <p className="eyebrow">
          {workTypeLabel(work.type)}
          {work.parent && (
            <>
              {" · in "}
              <Link href={`/works/${work.parent.slug}`}>{work.parent.title}</Link>
            </>
          )}
        </p>
        <h1 className="page-title">{work.title}</h1>
        <p className="page-subtitle tnum">{subtitleParts.join(" · ")}</p>
      </div>

      {work.synopsis && (
        <div className="prose">
          <p>{work.synopsis}</p>
        </div>
      )}

      {work.editions.length > 0 && (
        <section>
          <h2 className="section-label">Editions</h2>
          <ul className="editions">
            {work.editions.map((edition) => (
              <li key={edition.id} className="editions__item">
                {editionFormatLabel(edition.format)}
                {edition.label ? ` — ${edition.label}` : ""}
                <span className="tnum"> · {pluralize(edition.quotes.length, "quote")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.children.length > 0 && (
        <section>
          <h2 className="section-label">Episodes ({work.children.length})</h2>
          <div className="rows">
            {work.children.map((child) => {
              const childCode = episodeCode(child.seasonNumber, child.episodeNumber);
              return (
                <div key={child.id} className="row">
                  <Link href={`/works/${child.slug}`} className="row-link">
                    <span>
                      {childCode && <span className="row__eyebrow">{childCode}</span>}
                      <span className="row__title">{child.title}</span>
                    </span>
                    <span className="row__meta tnum">{pluralize(child.quoteCount, "quote")}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {totalQuotes > 0 ? (
        <section>
          <h2 className="section-label">Quotes ({totalQuotes})</h2>
          <QuoteList
            quotes={quotes.map((quote) => ({
              slug: quote.slug,
              text: quote.preview,
              meta: multipleEditions ? <span>{editionFormatLabel(quote.editionFormat)}</span> : undefined,
            }))}
          />
        </section>
      ) : (
        work.children.length === 0 && <p className="muted-note">No quotes yet.</p>
      )}
      </div>
    </div>
  );
}
