import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  if (!isAdmin({ id: session.user.githubId, login: session.user.githubLogin })) {
    return (
      <div className="container">
        <div className="empty">
          <h1 className="page-title">Not authorized</h1>
          <p className="empty__hint">
            Your GitHub account isn’t on the admin allowlist. Add your username or numeric id to{" "}
            <code>ADMIN_ACCOUNTS</code>, then sign out and back in.
          </p>
          <p className="empty__hint tnum">
            Signed in as {session.user.githubLogin ?? session.user.name ?? "unknown"} (id{" "}
            {session.user.githubId ?? "unknown"}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="admin-bar">
        <span className="eyebrow">Admin</span>
        <nav className="admin-bar__nav" aria-label="Admin">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/works">Works</Link>
          <Link href="/admin/characters">Characters</Link>
          <Link href="/admin/quotes/new">Add quote</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
