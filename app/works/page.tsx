import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listWorks } from "@/repositories/works";
import type { WorkType } from "@/db/schema";
import { episodeCode, pluralize, workTypeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Works" };

type SearchParams = Promise<{ type?: string }>;

const TABS: { label: string; type?: WorkType }[] = [
  { label: "All" },
  { label: "Films", type: "MOVIE" },
  { label: "TV", type: "TV_SERIES" },
  { label: "Books", type: "BOOK" },
];

function parseType(value: string | undefined): WorkType | undefined {
  if (value === "MOVIE" || value === "TV_SERIES" || value === "BOOK") return value;
  return undefined;
}

export default async function WorksPage({ searchParams }: { searchParams: SearchParams }) {
  const { type: rawType } = await searchParams;
  const type = parseType(rawType);

  const db = getDb();
  const works = await listWorks(db, { topLevelOnly: true, type });

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Works</h1>
        <p className="page-subtitle">Films, television, and books in the archive.</p>
      </div>

      <nav className="tabs" aria-label="Filter by type">
        {TABS.map((tab) => {
          const href = tab.type ? `/works?type=${tab.type}` : "/works";
          const current = tab.type === type;
          return (
            <Link key={tab.label} href={href} className="tab" aria-current={current}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {works.length === 0 ? (
        <div className="empty">
          <p>No works to show yet.</p>
        </div>
      ) : (
        <div className="rows">
          {works.map((work) => {
            const code = episodeCode(work.seasonNumber, work.episodeNumber);
            return (
              <div key={work.id} className="row">
                <Link href={`/works/${work.slug}`} className="row-link">
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
    </div>
  );
}
