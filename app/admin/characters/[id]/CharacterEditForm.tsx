"use client";

import { useState, useTransition } from "react";
import { deleteCharacterAction, updateCharacterAction } from "../actions";
import type { UpdateCharacterPayload } from "../types";
import { pluralize } from "@/lib/format";

type Props = {
  id: string;
  slug: string;
  quoteCount: number;
  initial: UpdateCharacterPayload;
};

export function CharacterEditForm({ id, slug, quoteCount, initial }: Props) {
  const [fields, setFields] = useState<UpdateCharacterPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function update(patch: Partial<UpdateCharacterPayload>) {
    setFields((current) => ({ ...current, ...patch }));
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const result = await updateCharacterAction(id, fields);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  function remove() {
    setError(null);
    startDeleting(async () => {
      // On success the action redirects to /admin/characters; only an error returns.
      const result = await deleteCharacterAction(id);
      if (result?.error) setError(result.error);
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
          <a href={`/characters/${slug}`}>/characters/{slug}</a> · {pluralize(quoteCount, "quote")}
        </p>

        <label className="admin-form__field">
          <span className="admin-form__label">Name</span>
          <input
            className="admin-form__control"
            value={fields.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>

        <label className="admin-form__field">
          <span className="admin-form__label">Description</span>
          <textarea
            className="admin-form__control"
            rows={4}
            value={fields.description}
            onChange={(event) => update({ description: event.target.value })}
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

      <div className="admin-form__actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <fieldset className="admin-form__group admin-form__danger">
        <legend className="section-label">Danger zone</legend>
        {!confirmingDelete ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete character
          </button>
        ) : (
          <>
            <p className="admin-form__hint">
              {quoteCount > 0
                ? `This character appears in ${pluralize(quoteCount, "quote")}; deleting removes it from them (the quotes stay). This can’t be undone.`
                : "This character isn’t used in any quotes. This can’t be undone."}
            </p>
            <div className="admin-form__actions">
              <button type="button" className="btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </fieldset>
    </form>
  );
}
