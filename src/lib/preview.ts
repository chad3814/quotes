const PREVIEW_LENGTH = 160;

export function quotePreview(searchText: string): string {
  const flat = searchText.replace(/\n/g, " ").trim();
  return flat.length <= PREVIEW_LENGTH ? flat : `${flat.slice(0, PREVIEW_LENGTH - 1)}…`;
}
