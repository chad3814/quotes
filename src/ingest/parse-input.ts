export type TmdbInput = { type: "movie" | "tv"; id: number };

const PATTERN = /(?:^|\/)(movie|tv)\/(\d+)/;

export function parseInput(input: string): TmdbInput {
  const match = PATTERN.exec(input.trim());
  if (!match) throw new Error(`unrecognized TMDB input: ${input}`);
  const type = match[1] === "movie" ? "movie" : "tv";
  return { type, id: Number(match[2]) };
}
