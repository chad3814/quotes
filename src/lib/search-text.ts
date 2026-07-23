export function buildSearchText(lines: { ordinal: number; content: string }[]): string {
  return [...lines]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((line) => line.content.trim())
    .filter((content) => content.length > 0)
    .join("\n");
}
