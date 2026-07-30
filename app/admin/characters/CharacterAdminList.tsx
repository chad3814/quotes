"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { pluralize } from "@/lib/format";

type Item = { id: string; name: string; slug: string; quoteCount: number };

export function CharacterAdminList({ characters }: { characters: Item[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q === "" ? characters : characters.filter((character) => character.name.toLowerCase().includes(q))),
    [characters, q],
  );

  return (
    <>
      <div className="admin-form__field">
        <input
          className="admin-form__control"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${pluralize(characters.length, "character")}…`}
          aria-label="Filter characters by name"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>{characters.length === 0 ? "No characters yet." : "No characters match that filter."}</p>
        </div>
      ) : (
        <div className="rows">
          {filtered.map((character) => (
            <div key={character.id} className="row">
              <Link href={`/admin/characters/${character.id}`} className="row-link">
                <span className="row__title">{character.name}</span>
                <span className="row__meta tnum">{pluralize(character.quoteCount, "quote")}</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
