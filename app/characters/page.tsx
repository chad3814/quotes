import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listCharacters } from "@/repositories/characters";
import { pluralize } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Characters" };

export default async function CharactersPage() {
  const characters = await listCharacters(getDb());

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Characters</h1>
        <p className="page-subtitle">People who speak, and are spoken about, in the archive.</p>
      </div>

      {characters.length === 0 ? (
        <div className="empty">
          <p>No characters to show yet.</p>
        </div>
      ) : (
        <div className="rows">
          {characters.map((character) => (
            <div key={character.id} className="row">
              <Link href={`/characters/${character.slug}`} className="row-link">
                <span className="row__title">{character.name}</span>
                <span className="row__meta tnum">{pluralize(character.quoteCount, "quote")}</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
