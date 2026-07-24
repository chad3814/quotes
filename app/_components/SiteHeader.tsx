"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchInput } from "./SearchInput";

const NAV_ITEMS = [
  { href: "/works", label: "Works" },
  { href: "/characters", label: "Characters" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="site-header">
      <div className="wide site-header__inner">
        <Link href="/" className="wordmark">
          iqdb
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {!isHome && <SearchInput variant="compact" />}
      </div>
    </header>
  );
}
