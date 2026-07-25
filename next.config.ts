import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve images through <img>/next-image WITHOUT the Vercel Image
    // Optimization API — that per-transform billing is not worth it here.
    unoptimized: true,
    // Kept for documentation / in case optimization is ever re-enabled (ignored
    // while `unoptimized` is true).
    remotePatterns: [
      // GitHub avatars, shown next to the signed-in user's name.
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // TMDB poster / still images on work pages.
      { protocol: "https", hostname: "image.tmdb.org" },
      // IBDB book covers (served from ISBNdb).
      { protocol: "https", hostname: "images.isbndb.com" },
    ],
  },
};

export default nextConfig;
