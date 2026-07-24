import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getCharacterPageBySlug, type QuoteSummary } from "@/repositories/characters";
import { pluralize } from "@/lib/format";
import { QuoteList } from "../../_components/QuoteList";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

// Deduplicate the DB read shared by generateMetadata and the page (one query/request).
const loadCharacter = cache((slug: string) => getCharacterPageBySlug(getDb(), slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadCharacter(slug);
  return { title: page?.character.name ?? "Character" };
}

function toEntries(quotes: QuoteSummary[]) {
  return quotes.map((quote) => ({ slug: quote.slug, text: quote.preview }));
}

export default async function CharacterPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await loadCharacter(slug);
  if (!page) notFound();

  const { character, asSpeaker, asSubject } = page;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{character.name}</h1>
        <p className="page-subtitle tnum">
          {pluralize(asSpeaker.length, "quote")} as speaker · {pluralize(asSubject.length, "quote")} as subject
        </p>
      </div>

      {character.description && (
        <div className="prose">
          <p>{character.description}</p>
        </div>
      )}

      <section>
        <h2 className="section-label">As speaker ({asSpeaker.length})</h2>
        {asSpeaker.length > 0 ? (
          <QuoteList quotes={toEntries(asSpeaker)} />
        ) : (
          <p className="muted-note">No quotes as speaker yet.</p>
        )}
      </section>

      <hr className="hairline" />

      <section>
        <h2 className="section-label">As subject ({asSubject.length})</h2>
        {asSubject.length > 0 ? (
          <QuoteList quotes={toEntries(asSubject)} />
        ) : (
          <p className="muted-note">No quotes as subject yet.</p>
        )}
      </section>
    </div>
  );
}
