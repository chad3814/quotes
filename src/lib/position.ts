import type { EditionFormat } from "@/db/schema";

export type Position = {
  startMs?: number | null;
  endMs?: number | null;
  chapter?: string | null;
  page?: number | null;
  percent?: number | null;
  locationNote?: string | null;
};

export type EditionContext = {
  format: EditionFormat;
  runtimeMs: number | null;
  pageCount: number | null;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

const TIME_BASED: ReadonlySet<EditionFormat> = new Set<EditionFormat>([
  "THEATRICAL",
  "DIRECTORS_CUT",
  "EXTENDED",
  "REMASTER",
  "TV_BROADCAST",
  "AUDIOBOOK",
]);

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

export function validatePosition(position: Position, edition: EditionContext): ValidationResult {
  const { startMs, endMs, page, percent } = position;

  if (startMs != null) {
    if (startMs < 0) return fail("startMs must be >= 0");
    if (!TIME_BASED.has(edition.format)) return fail(`startMs is not valid for format ${edition.format}`);
    if (edition.runtimeMs != null && startMs > edition.runtimeMs) return fail("startMs exceeds edition runtime");
  }
  if (endMs != null) {
    if (startMs == null) return fail("endMs requires startMs");
    if (endMs < startMs) return fail("endMs must be >= startMs");
    if (edition.runtimeMs != null && endMs > edition.runtimeMs) return fail("endMs exceeds edition runtime");
  }
  if (page != null) {
    if (page < 1) return fail("page must be >= 1");
    if (edition.pageCount != null && page > edition.pageCount) return fail("page exceeds edition page count");
  }
  if (percent != null && (percent < 0 || percent > 100)) {
    return fail("percent must be between 0 and 100");
  }
  return { ok: true };
}
