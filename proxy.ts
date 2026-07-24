import { auth } from "@/auth";

// Next.js 16 renamed `middleware` to `proxy`. This runs on the Node.js runtime by
// default. It only provides a fast redirect for unauthenticated visitors to /admin;
// the authoritative admin-allowlist check lives in app/admin/layout.tsx (a proxy is
// a routing/UX layer, not a security boundary).
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
