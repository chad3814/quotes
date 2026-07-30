# Merge characters — design

## Problem

The catalogue accumulates duplicate characters: the same person entered under
slightly different names (e.g. "Princess Leia" vs "Princess Leia Organa"), or a
new character created by mistake before the id-aware combobox landed. Admins can
already edit and delete characters, but deleting a duplicate throws away its
quote attributions. The real fix is to **merge** the duplicate into the
canonical character so no attributions are lost.

This was done once by hand (SQL) for Princess Leia; this feature makes it a
first-class admin action.

## Scope

- Merge one character (the **source**, the one being viewed) into another
  (the **target**), from the source's `/admin/characters/[id]` edit page.
- The source's attributions move to the target; the source is then deleted; the
  admin lands on the target's edit page.
- Out of scope: bulk/auto de-duplication, merging works or quotes, keeping the
  source's name/description (the target is canonical and keeps its own).

## Direction & semantics

- **Direction:** on character X's edit page, "Merge this character into…" picks a
  target Y. X's attributions are repointed to Y, X is deleted, redirect to Y.
- **Attribution move with collision handling.** For each of X's attributions on
  line L with role R:
  - If Y already has an attribution on the same (line L, role R), **drop** X's
    attribution. This both avoids a duplicate SUBJECT on a line and satisfies the
    `attributions_one_speaker_per_line_uq` partial unique index (one SPEAKER per
    line).
  - Otherwise **repoint** it to Y (`character_id = Y`).
- **Name/description:** Y keeps its own; X's are discarded with X.
- **Atomicity:** the whole merge runs in a transaction, so a failure leaves both
  characters untouched.
- **Guards:** merging a character into itself throws; a missing source or target
  throws. Both surface as a user-facing error on the form.

## Data model touchpoints

- `attributions.character_id` → `characters.id` (`onDelete: cascade`).
- `attributions_one_speaker_per_line_uq`: `uniqueIndex(line_id) where role = 'SPEAKER'`.
- No schema change; no migration.

## Components

### Repository — `src/repositories/characters.ts`

```
mergeCharacters(db, { sourceId, targetId }): Promise<{ id: string; slug: string }>
```

Transaction:
1. Throw if `sourceId === targetId`.
2. Load both characters; throw "Character not found." if either is missing.
3. `DELETE` source attributions that collide with a target attribution on
   `(line_id, role)`.
4. `UPDATE attributions SET character_id = target WHERE character_id = source`.
5. `DELETE` the source character.
6. Return the target's `{ id, slug }`.

### Server action — `app/admin/characters/actions.ts`

```
mergeCharacterAction(sourceId, targetId): Promise<{ error: string }>
```

Admin-gated. Validates a target was chosen and differs from the source, calls
`mergeCharacters`, revalidates `/admin/characters`, `/characters`, and both
characters' public pages, then `redirect`s to `/admin/characters/<targetId>`.
(Returns only on error, mirroring `deleteCharacterAction`.)

### UI

- **Target picker:** reuse `CharacterCombobox` with a new `allowCreate={false}`
  prop so it only *selects* existing characters (no "Create …" row, no
  commit-new-on-blur) and binds the chosen id. The current character is excluded
  from the options so you can't merge into yourself.
- **Placement:** a "Merge" section on `/admin/characters/[id]`, above the Danger
  zone. Pick a target, then a confirm step: "Move this character's N quotes into
  <target> and delete this character. This can't be undone." Confirm runs the
  action.

## `CharacterCombobox` change

Add `allowCreate?: boolean` (default `true`, preserving current callers). When
`false`:
- The "Create '<query>'" row is never shown.
- Blur/Enter only bind to an **exact existing** match (case-insensitive);
  otherwise the field reverts to the last valid selection's label (never emits a
  `{ name }`-only ref).

## Testing

Repository tests (`tests/repositories/characters.test.ts`):
- Moves the source's attributions to the target (target gains the source's quotes).
- Drops a colliding SUBJECT (target not duplicated on the shared line).
- Drops a colliding SPEAKER without violating the one-speaker-per-line index.
- Deletes the source character.
- Throws on self-merge and on a missing source/target.

The admin UI is gated, so (as with the other admin work) it's covered by
build + typecheck + the repository tests rather than an E2E test.
