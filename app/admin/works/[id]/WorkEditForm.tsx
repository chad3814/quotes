"use client";

import { useState, useTransition } from "react";
import type { WorkType } from "@/db/schema";
import { resyncWorkAction, updateWorkAction } from "../actions";
import type { UpdateWorkPayload } from "../types";

type Props = {
  id: string;
  slug: string;
  type: WorkType;
  typeLabel: string;
  initial: UpdateWorkPayload;
  /** True for movies / TV series that carry a TMDb reference. */
  canResync: boolean;
  /** True for episodes, which have season/episode numbers worth editing. */
  showEpisodeFields: boolean;
};

export function WorkEditForm({ id, slug, typeLabel, initial, canResync, showEpisodeFields }: Props) {
  const [fields, setFields] = useState<UpdateWorkPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [resyncing, startResync] = useTransition();

  function update(patch: Partial<UpdateWorkPayload>) {
    setFields((current) => ({ ...current, ...patch }));
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const result = await updateWorkAction(id, fields);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  function resync() {
    setError(null);
    setResyncMessage(null);
    startResync(async () => {
      const result = await resyncWorkAction(id);
      if (result.error) setError(result.error);
      else setResyncMessage(result.message ?? "Re-synced from TMDb.");
    });
  }

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <fieldset className="admin-form__group">
        <legend className="section-label">Details</legend>
        <p className="admin-form__hint tnum">
          {typeLabel} · <a href={`/works/${slug}`}>/works/{slug}</a>
        </p>

        <label className="admin-form__field">
          <span className="admin-form__label">Title</span>
          <input
            className="admin-form__control"
            value={fields.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>

        <label className="admin-form__field">
          <span className="admin-form__label">Original title</span>
          <input
            className="admin-form__control"
            value={fields.originalTitle}
            onChange={(event) => update({ originalTitle: event.target.value })}
          />
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Year</span>
            <input
              className="admin-form__control"
              inputMode="numeric"
              value={fields.year}
              onChange={(event) => update({ year: event.target.value })}
            />
          </label>
          {showEpisodeFields && (
            <>
              <label className="admin-form__field admin-form__field--narrow">
                <span className="admin-form__label">Season</span>
                <input
                  className="admin-form__control"
                  inputMode="numeric"
                  value={fields.seasonNumber}
                  onChange={(event) => update({ seasonNumber: event.target.value })}
                />
              </label>
              <label className="admin-form__field admin-form__field--narrow">
                <span className="admin-form__label">Episode</span>
                <input
                  className="admin-form__control"
                  inputMode="numeric"
                  value={fields.episodeNumber}
                  onChange={(event) => update({ episodeNumber: event.target.value })}
                />
              </label>
            </>
          )}
        </div>

        <label className="admin-form__field">
          <span className="admin-form__label">Synopsis</span>
          <textarea
            className="admin-form__control"
            rows={4}
            value={fields.synopsis}
            onChange={(event) => update({ synopsis: event.target.value })}
          />
        </label>
      </fieldset>

      {error && (
        <p className="admin-form__error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="admin-form__ok" role="status">
          Saved.
        </p>
      )}
      {resyncMessage && (
        <p className="admin-form__ok" role="status">
          {resyncMessage}
        </p>
      )}

      <div className="admin-form__actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {canResync && (
          <button type="button" className="btn-secondary" onClick={resync} disabled={resyncing}>
            {resyncing ? "Re-syncing…" : "Re-sync from TMDb"}
          </button>
        )}
      </div>
    </form>
  );
}
