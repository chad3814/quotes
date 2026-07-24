import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">About iqdb</h1>
        <p className="page-subtitle">A typeset database of quotations.</p>
      </div>

      <div className="prose">
        <p>
          iqdb collects memorable lines from film, television, and books and records not just the words but
          their context — who said them, who they were about, the edition they appear in, and where in the
          runtime or on the page they land.
        </p>
        <p>
          Every quote is full-text searchable. Browse the <Link href="/works">works</Link> or the{" "}
          <Link href="/characters">characters</Link>, or start from the{" "}
          <Link href="/search">search</Link> and follow the lines wherever they lead.
        </p>
        <p>Title and edition metadata is sourced via TMDB.</p>
      </div>
    </div>
  );
}
