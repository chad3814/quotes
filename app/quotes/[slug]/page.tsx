import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getQuoteBySlug } from "@/repositories/quotes";
import { editionFormatLabel, formatPosition, workTypeLabel } from "@/lib/format";
import { AdminEditLink } from "../../_components/AdminEditLink";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

type Person = { name: string; slug: string };

// Deduplicate the DB read shared by generateMetadata and the page (one query/request).
const loadQuote = cache((slug: string) => getQuoteBySlug(getDb(), slug));

function truncate(value: string, max = 70): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const quote = await loadQuote(slug);
  if (!quote) return { title: "Quote" };
  const first = quote.lines[0]?.content ?? "Quote";
  return { title: truncate(first) };
}

export default async function QuotePage({ params }: { params: Params }) {
  const { slug } = await params;
  const quote = await loadQuote(slug);
  if (!quote) notFound();

  const session = await auth();
  const admin = isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin });

  const speakers: Person[] = [];
  const subjects: Person[] = [];
  const seenSpeaker = new Set<string>();
  const seenSubject = new Set<string>();
  for (const line of quote.lines) {
    for (const attr of line.attributions) {
      const person = { name: attr.characterName, slug: attr.characterSlug };
      if (attr.role === "SPEAKER" && !seenSpeaker.has(attr.characterId)) {
        seenSpeaker.add(attr.characterId);
        speakers.push(person);
      }
      if (attr.role === "SUBJECT" && !seenSubject.has(attr.characterId)) {
        seenSubject.add(attr.characterId);
        subjects.push(person);
      }
    }
  }

  const positionChips = formatPosition(quote.position);
  const { work, edition } = quote.source;

  return (
    <div className="quote-page">
      <h1 className="sr-only">Quote from {work.title}</h1>
      <p className="quote-page__eyebrow">
        <Link href={`/works/${work.slug}`}>{work.title}</Link>
        {" · "}
        {editionFormatLabel(edition.format)}
        {admin && <AdminEditLink href={`/admin/quotes/${quote.id}/edit`} label="Edit this quote" />}
      </p>

      <blockquote className="blockquote">
        {quote.lines.map((line) => {
          const speaker = line.attributions.find((attr) => attr.role === "SPEAKER");
          const lineClass =
            line.type === "STAGE_DIRECTION"
              ? "blockquote__line blockquote__line--stage"
              : "blockquote__line";
          return (
            <span key={line.ordinal} className={lineClass}>
              {speaker && <span className="blockquote__speaker">{speaker.characterName}</span>}
              <span className="blockquote__content">{line.content}</span>
            </span>
          );
        })}
      </blockquote>

      <div className="attribution">
        {speakers.length > 0 && (
          <div className="attr-row">
            <span className="attr-row__label">Spoken by</span>
            <span className="attr-row__value">
              {speakers.map((person, index) => (
                <span key={person.slug}>
                  {index > 0 && ", "}
                  <Link href={`/characters/${person.slug}`}>{person.name}</Link>
                </span>
              ))}
            </span>
          </div>
        )}

        {subjects.length > 0 && (
          <div className="attr-row">
            <span className="attr-row__label">About</span>
            <span className="attr-row__value">
              {subjects.map((person, index) => (
                <span key={person.slug}>
                  {index > 0 && ", "}
                  <Link href={`/characters/${person.slug}`}>{person.name}</Link>
                </span>
              ))}
            </span>
          </div>
        )}

        <div className="attr-row">
          <span className="attr-row__label">Source</span>
          <span className="attr-row__value">
            <Link href={`/works/${work.slug}`}>
              {work.title}
              {work.year ? ` (${work.year})` : ""}
            </Link>
            <span className="page-subtitle">
              {" · "}
              {workTypeLabel(work.type)}
            </span>
          </span>
        </div>

        {positionChips.length > 0 && (
          <div className="attr-row">
            <span className="attr-row__label">Position</span>
            <span className="pos-chips">
              {positionChips.map((chip) => (
                <span key={chip} className="pos-chip">
                  {chip}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
