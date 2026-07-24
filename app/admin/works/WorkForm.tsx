"use client";

import { useState, useTransition } from "react";
import type { WorkType } from "@/db/schema";
import { createWorkAction } from "./actions";
import type { CreateWorkPayload } from "./types";
import { TmdbTitleSearch, type TmdbHit } from "./TmdbTitleSearch";

const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: "MOVIE", label: "Film" },
  { value: "TV_SERIES", label: "TV series" },
  { value: "BOOK", label: "Book" },
];

function tmdbMediaType(type: WorkType): "movie" | "tv" | null {
  if (type === "MOVIE") return "movie";
  if (type === "TV_SERIES") return "tv";
  return null;
}

export function WorkForm() {
  const [type, setType] = useState<WorkType>("MOVIE");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  // Set when a TMDb result is chosen; cleared as soon as the title is edited by hand.
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mediaType = tmdbMediaType(type);

  function updateTitle(next: string) {
    setTitle(next);
    setTmdbId(null);
  }

  function selectHit(hit: TmdbHit) {
    setTitle(hit.title);
    setYear(hit.year != null ? String(hit.year) : "");
    setTmdbId(hit.id);
  }

  function changeType(next: WorkType) {
    setType(next);
    setTmdbId(null);
  }

  function submit() {
    setError(null);

    const payload: CreateWorkPayload =
      mediaType && tmdbId != null
        ? { mode: "tmdb", tmdbType: mediaType, tmdbId }
        : { mode: "manual", type, title, year, originalTitle, synopsis };

    startTransition(async () => {
      const result = await createWorkAction(payload);
      // On success the action redirects to the editor; only an error comes back.
      if (result?.error) setError(result.error);
    });
  }

  const importing = mediaType != null && tmdbId != null;

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="admin-form__group">
        <legend className="section-label">Work</legend>
        <div className="admin-form__row">
          <label className="admin-form__field">
            <span className="admin-form__label">Type</span>
            <select
              className="admin-form__control"
              value={type}
              onChange={(event) => changeType(event.target.value as WorkType)}
            >
              {WORK_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form__field admin-form__field--grow">
            <span className="admin-form__label">Title</span>
            {mediaType ? (
              <TmdbTitleSearch
                id="work-title"
                type={mediaType}
                value={title}
                onChange={updateTitle}
                onSelect={selectHit}
                placeholder="Search TMDb…"
              />
            ) : (
              <input
                className="admin-form__control"
                value={title}
                onChange={(event) => updateTitle(event.target.value)}
                placeholder="e.g. Dune"
              />
            )}
          </label>

          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Year</span>
            <input
              className="admin-form__control"
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              placeholder="1965"
              disabled={importing}
            />
          </label>
        </div>

        {importing ? (
          <p className="admin-form__hint">
            Selected a TMDb title — saving will import it from TMDb (creating its edition
            {mediaType === "tv" ? " and all episodes" : ""}).{" "}
            <button type="button" className="admin-line__remove" onClick={() => setTmdbId(null)}>
              Enter manually instead
            </button>
          </p>
        ) : (
          <>
            <label className="admin-form__field">
              <span className="admin-form__label">Original title (optional)</span>
              <input
                className="admin-form__control"
                value={originalTitle}
                onChange={(event) => setOriginalTitle(event.target.value)}
              />
            </label>
            <label className="admin-form__field">
              <span className="admin-form__label">Synopsis (optional)</span>
              <textarea
                className="admin-form__control"
                rows={3}
                value={synopsis}
                onChange={(event) => setSynopsis(event.target.value)}
              />
            </label>
          </>
        )}
      </fieldset>

      {error && (
        <p className="admin-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-form__actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : importing ? "Import from TMDb" : "Create work"}
        </button>
      </div>
    </form>
  );
}
