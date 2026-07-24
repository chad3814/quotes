const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export type PosterSize = "w185" | "w342" | "w500";

/**
 * Resolves a stored `posterPath` to a displayable image URL, or null when empty.
 *
 * - A full URL (e.g. a book cover from IBDB, `https://images.isbndb.com/…`) is
 *   returned unchanged.
 * - Otherwise the value is treated as a TMDB image path ("/abc.jpg") and a
 *   sized TMDB URL is built.
 */
export function posterImageUrl(path: string | null | undefined, size: PosterSize = "w342"): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}/${size}${normalized}`;
}
