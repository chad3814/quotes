import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listWorks } from "@/repositories/works";
import { episodeCode, pluralize, workTypeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Works" };

export default async function AdminWorksPage() {
  const db = getDb();
  const works = await listWorks(db, { topLevelOnly: true });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Works</h1>
        <p className="page-subtitle tnum">{pluralize(works.length, "work")}</p>
      </div>

      <div className="admin-form__actions">
        <Link href="/admin/works/new" className="btn-primary admin-cta">
          + Add a work
        </Link>
      </div>

      {works.length === 0 ? (
        <div className="empty">
          <p>No works yet.</p>
        </div>
      ) : (
        <div className="rows">
          {works.map((work) => {
            const code = episodeCode(work.seasonNumber, work.episodeNumber);
            return (
              <div key={work.id} className="row">
                <Link href={`/admin/works/${work.id}`} className="row-link">
                  <span>
                    <span className="row__eyebrow">{workTypeLabel(work.type)}</span>
                    <span className="row__title">{work.title}</span>
                  </span>
                  <span className="row__meta tnum">
                    {code ? `${code} · ` : ""}
                    {work.year ? `${work.year} · ` : ""}
                    {pluralize(work.quoteCount, "quote")}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
