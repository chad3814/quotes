import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: { githubId: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubId?: string;
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
  callbacks: {
    // `profile` is only present on the initial sign-in; persist the numeric GitHub
    // user id on the token so it survives subsequent (profile-less) calls.
    jwt({ token, profile }) {
      if (profile?.id != null) {
        token.githubId = String(profile.id);
      }
      return token;
    },
    // Surface the GitHub id on the session so server code can check it against the
    // admin allowlist (used by the gated /admin area).
    session({ session, token }) {
      if (token.githubId) {
        session.user.githubId = token.githubId;
      }
      return session;
    },
  },
});
