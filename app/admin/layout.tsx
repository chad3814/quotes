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

  if (!isAdmin(session.user.githubId)) {
    return (
      <div className="container">
        <div className="empty">
          <h1 className="page-title">Not authorized</h1>
          <p className="empty__hint">Your GitHub account isn’t on the admin allowlist.</p>
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
          <Link href="/admin/quotes/new">Add quote</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
