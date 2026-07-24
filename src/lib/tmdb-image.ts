const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export type PosterSize = "w185" | "w342" | "w500";

/**
 * Builds a TMDB image URL from a stored poster/still path (e.g. "/abc.jpg"),
 * or null when there is no path (the UI then shows a placeholder).
 */
export function tmdbPosterUrl(path: string | null | undefined, size: PosterSize = "w342"): string | null {
  if (!path) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}/${size}${normalized}`;
}
