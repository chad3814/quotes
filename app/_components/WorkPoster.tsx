import Image from "next/image";
import type { WorkType } from "@/db/schema";
import { workTypeLabel } from "@/lib/format";
import { tmdbPosterUrl } from "@/lib/tmdb-image";

type Props = {
  posterPath: string | null;
  title: string;
  type: WorkType;
};

/**
 * A work's poster. Renders the real TMDB image when a path is stored, otherwise
 * a typeset placeholder (2:3) so the layout is consistent either way.
 */
export function WorkPoster({ posterPath, title, type }: Props) {
  const url = tmdbPosterUrl(posterPath, "w342");

  return (
    <div className="poster">
      {url ? (
        <Image
          className="poster__img"
          src={url}
          alt={`Poster for ${title}`}
          width={342}
          height={513}
          sizes="(max-width: 80rem) 40vw, 11rem"
        />
      ) : (
        <div className="poster__placeholder">
          <span className="poster__ph-type">{workTypeLabel(type)}</span>
          <span className="poster__ph-title">{title}</span>
        </div>
      )}
    </div>
  );
}
