import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkById } from "@/repositories/works";
import { getExternalReference } from "@/repositories/external-references";
import { workTypeLabel } from "@/lib/format";
import { tmdbInputForWork } from "@/lib/tmdb";
import { WorkEditForm } from "./WorkEditForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit work" };

type Params = Promise<{ id: string }>;

function toField(value: number | string | null): string {
  return value == null ? "" : String(value);
}

export default async function EditWorkPage({ params }: { params: Params }) {
  const { id } = await params;
  const db = getDb();
  const work = await getWorkById(db, id);
  if (!work) notFound();

  const tmdbRef = await getExternalReference(db, "WORK", id, "TMDB");
  const canResync = tmdbRef != null && tmdbInputForWork(work.type, tmdbRef.externalId) != null;
  const showEpisodeFields = work.type === "TV_EPISODE";

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Edit work</h1>
        <p className="page-subtitle">{work.title}</p>
      </div>
      <WorkEditForm
        id={work.id}
        slug={work.slug}
        type={work.type}
        typeLabel={workTypeLabel(work.type)}
        canResync={canResync}
        showEpisodeFields={showEpisodeFields}
        initial={{
          title: work.title,
          originalTitle: toField(work.originalTitle),
          year: toField(work.year),
          seasonNumber: toField(work.seasonNumber),
          episodeNumber: toField(work.episodeNumber),
          synopsis: toField(work.synopsis),
        }}
      />
    </>
  );
}
