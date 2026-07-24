import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { AuthButton } from "./_components/AuthButton";

export const metadata: Metadata = {
  metadataBase: new URL("https://tqdb.org"),
  title: {
    default: "TQDb — The Quote Database",
    template: "%s · TQDb",
  },
  description: "A typeset database of quotations from film, television, and books.",
};

// Applies a saved manual theme before first paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader authSlot={<AuthButton />} />
        <main id="main" className="site-main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
