import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wide site-footer__inner">
        <div className="site-footer__word">TQDb</div>
        <p>A typeset database of quotations from film, television, and books.</p>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/works">Works</Link>
          <Link href="/characters">Characters</Link>
          <Link href="/about">About</Link>
        </nav>
        <p>Title &amp; metadata sourced via TMDB.</p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
