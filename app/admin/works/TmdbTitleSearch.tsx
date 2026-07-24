"use client";

import { useEffect, useRef, useState } from "react";

export type TmdbHit = { id: number; title: string; year: number | null; mediaType: "movie" | "tv" };

type Props = {
  type: "movie" | "tv";
  value: string;
  onChange: (value: string) => void;
  onSelect: (hit: TmdbHit) => void;
  placeholder?: string;
  id?: string;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Title input with a debounced TMDb typeahead. Fetches are debounced by
 * {@link DEBOUNCE_MS}, aborted when superseded, and stale responses are dropped
 * so only the latest query's results are shown.
 */
export function TmdbTitleSearch({ type, value, onChange, onSelect, placeholder, id }: Props) {
  const [results, setResults] = useState<TmdbHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const latestQuery = useRef("");

  useEffect(() => {
    const query = value.trim();
    latestQuery.current = query;

    // All state updates happen inside the debounced callback (never synchronously
    // in the effect body) so a keystroke doesn't trigger a cascading re-render.
    const handle = setTimeout(async () => {
      if (query.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setLoading(false);
        setOpen(false);
        return;
      }

      setLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/admin/tmdb-search?type=${type}&q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data: { results?: TmdbHit[] } = await res.json();
        if (latestQuery.current !== query) return; // a newer query has started
        setResults(data.results ?? []);
        setOpen(true);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setResults([]);
      } finally {
        if (latestQuery.current === query) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [value, type]);

  function choose(hit: TmdbHit) {
    setOpen(false);
    setResults([]);
    onSelect(hit);
  }

  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div className="tmdb-search">
      <input
        id={id}
        className="admin-form__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
      />
      {loading && <span className="tmdb-search__status" aria-live="polite">Searching…</span>}
      {open && results.length > 0 && (
        <ul className="tmdb-search__results" id={listboxId} role="listbox">
          {results.map((hit) => (
            <li key={hit.id} role="option" aria-selected={false}>
              {/* preventDefault on mousedown keeps the input from blurring before the click lands */}
              <button
                type="button"
                className="tmdb-search__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(hit)}
              >
                <span className="tmdb-search__title">{hit.title}</span>
                {hit.year != null && <span className="tmdb-search__year tnum">{hit.year}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
