# Admin works editor + TMDb autocomplete + admin shortcuts

Feature branch: `feat/admin-works-editor`

## Requested scope
1. Admin tool to **add / edit works**.
2. For existing works with a **TMDb external id**, a **re-sync** button that re-runs the ingest.
3. For **new movie/TV works**, a **debounced TMDb autocomplete** on the title field.
4. While browsing, a **⛨ admin-edit icon** on works and quotes (shown only to signed-in admins)
   that links to the admin editor for that item.

## Decisions (made without the user, per their instruction to use best judgment)

- **Quote editor is in scope.** The shield explicitly links to "the admin editor" for a quote, so a
  minimal but functional quote editor is required. It edits line content/type, speaker & subject
  character names, and position — mirroring the existing "add quote" authoring form.
- **Slugs are stable on edit.** Editing a work's or quote's title does *not* regenerate its slug, so
  existing URLs and inbound links keep working. (Documented in the update repo functions.)
- **TMDb search uses an admin-gated Route Handler** (`GET /api/admin/tmdb-search?type=&q=`) returning
  JSON, which is the idiomatic pattern for typeahead and easy to test. Auth is enforced with the same
  `auth()` + `isAdmin()` check used elsewhere.
- **Autocomplete debounce = 300ms**, min query length 2, requests are abortable (stale responses
  ignored).
- **"Add work" behavior:**
  - Movie/TV with a TMDb selection → runs the full `ingestTitle` ingest (creates work + editions +
    refs, and for TV all episodes). This reuses the existing, tested ingest path.
  - Manual entry (no TMDb selection) or Book → plain `createWork` (title/year/etc.).
- **Re-sync** is offered only for `MOVIE` / `TV_SERIES` works that have a `TMDB` `WORK` ref. Episodes
  are re-synced via their parent series, so no per-episode button.
- **Shields** appear on the work detail page (`/works/[slug]`) and quote detail page
  (`/quotes/[slug]`). `admin` is computed once per page via `auth()`/`isAdmin()` and passed down —
  no per-row auth calls.

## Testing
Repo/lib/server layers get unit tests (matching the existing suite, which has no React component
tests). Covered: `getExternalReference`, `getWorkById`, `updateWork` (slug stable), `updateQuote` /
`getQuoteForEdit`, the TMDb `search` client method, and any pure helpers (e.g. TMDb-media-type
mapping). Verified with `npm run verify` (lint + typecheck + test + build) before any commit.
