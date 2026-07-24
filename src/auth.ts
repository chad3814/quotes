import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: { githubId: string; githubLogin?: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubId?: string;
    githubLogin?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // The app's env uses GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET rather than the
    // AUTH_GITHUB_ID / AUTH_GITHUB_SECRET names Auth.js auto-detects, so pass them explicitly.
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  logger: {
    error(error: Error) {
      // A stale/invalid session cookie (e.g. left over from a different AUTH_SECRET
      // or another app on localhost) can't be decrypted, so Auth.js throws
      // JWTSessionError on every request until it's cleared. It already treats this
      // as "signed out", so downgrade the noisy stack trace to a single line and
      // surface every other auth error normally.
      if (error.name === "JWTSessionError") {
        console.warn(
          "[auth] Ignoring an undecryptable session cookie (stale token) — clear cookies for this site to remove this notice.",
        );
        return;
      }
      console.error(error);
    },
  },
  callbacks: {
    // `profile` is only present on the initial sign-in; persist the numeric GitHub
    // user id AND the login (username) on the token so both survive subsequent
    // (profile-less) calls. The admin allowlist may be keyed by either one.
    jwt({ token, profile }) {
      if (profile) {
        if (profile.id != null) token.githubId = String(profile.id);
        const login = (profile as { login?: unknown }).login;
        if (typeof login === "string") token.githubLogin = login;
      }
      return token;
    },
    // Surface the GitHub id + login on the session so server code can check them
    // against the admin allowlist (used by the gated /admin area).
    session({ session, token }) {
      if (token.githubId) session.user.githubId = token.githubId;
      if (token.githubLogin) session.user.githubLogin = token.githubLogin;
      return session;
    },
  },
});
