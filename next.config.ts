import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // GitHub avatars, shown next to the signed-in user's name.
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
};

export default nextConfig;
