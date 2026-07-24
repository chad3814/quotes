import { describe, expect, it } from "vitest";
import {
  editionFormatLabel,
  episodeCode,
  formatPosition,
  formatTimecode,
  parseTimecode,
  pluralize,
  workTypeLabel,
} from "@/lib/format";

describe("workTypeLabel / editionFormatLabel", () => {
  it("maps enum values to friendly labels", () => {
    expect(workTypeLabel("MOVIE")).toBe("Film");
    expect(workTypeLabel("TV_SERIES")).toBe("TV Series");
    expect(editionFormatLabel("DIRECTORS_CUT")).toBe("Director's Cut");
    expect(editionFormatLabel("TV_BROADCAST")).toBe("TV Broadcast");
  });
});

describe("episodeCode", () => {
  it("formats season and episode", () => {
    expect(episodeCode(2, 5)).toBe("S02E05");
    expect(episodeCode(12, 3)).toBe("S12E03");
  });
  it("handles partial and missing values", () => {
    expect(episodeCode(1, null)).toBe("S01");
    expect(episodeCode(null, 4)).toBe("E04");
    expect(episodeCode(null, null)).toBeNull();
  });
});

describe("formatTimecode", () => {
  it("drops the hour when zero", () => {
    expect(formatTimecode(5000)).toBe("0:05");
    expect(formatTimecode(65_000)).toBe("1:05");
  });
  it("includes the hour when present", () => {
    expect(formatTimecode(3_661_000)).toBe("1:01:01");
  });
});

describe("formatPosition", () => {
  it("builds a timecode range chip", () => {
    expect(formatPosition({ startMs: 5000, endMs: 8000, chapter: null, page: null, percent: null, locationNote: null })).toEqual([
      "0:05–0:08",
    ]);
  });
  it("builds chapter / page / percent / note chips", () => {
    expect(
      formatPosition({ startMs: null, endMs: null, chapter: "9", page: 214, percent: "12.50", locationNote: "epigraph" }),
    ).toEqual(["ch. 9", "p. 214", "12.5%", "epigraph"]);
  });
  it("returns nothing when the position is empty", () => {
    expect(formatPosition({ startMs: null, endMs: null, chapter: null, page: null, percent: null, locationNote: null })).toEqual(
      [],
    );
  });
});

describe("pluralize", () => {
  it("pluralizes based on count", () => {
    expect(pluralize(1, "quote")).toBe("1 quote");
    expect(pluralize(3, "quote")).toBe("3 quotes");
    expect(pluralize(0, "quote")).toBe("0 quotes");
  });
});

describe("parseTimecode", () => {
  it("parses h:mm:ss and m:ss", () => {
    expect(parseTimecode("1:23:45")).toBe((1 * 3600 + 23 * 60 + 45) * 1000);
    expect(parseTimecode("2:05")).toBe(125_000);
  });
  it("parses a bare number of seconds", () => {
    expect(parseTimecode("90")).toBe(90_000);
    expect(parseTimecode("0")).toBe(0);
  });
  it("returns null for empty or invalid input", () => {
    expect(parseTimecode("")).toBeNull();
    expect(parseTimecode("   ")).toBeNull();
    expect(parseTimecode("abc")).toBeNull();
    expect(parseTimecode("1:2:3:4")).toBeNull();
    expect(parseTimecode("1:xx")).toBeNull();
  });
  it("round-trips with formatTimecode", () => {
    const ms = parseTimecode("1:05:09");
    expect(ms).not.toBeNull();
    expect(formatTimecode(ms as number)).toBe("1:05:09");
  });
});
