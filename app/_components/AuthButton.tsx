import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { isAdmin } from "@/lib/admin";

function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/" });
      }}
    >
      <button type="submit" className="btn-secondary auth__signin">
        Sign in
      </button>
    </form>
  );
}

function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="auth__signout">
        Sign out
      </button>
    </form>
  );
}

export async function AuthButton() {
  const session = await auth();

  if (!session?.user) {
    return <SignIn />;
  }

  const admin = isAdmin({ id: session.user.githubId, login: session.user.githubLogin });

  return (
    <div className="auth">
      {admin && (
        <Link href="/admin" className="nav-link auth__admin">
          Admin
        </Link>
      )}
      {session.user.image && (
        <Image
          src={session.user.image}
          alt=""
          width={24}
          height={24}
          className="auth__avatar"
        />
      )}
      <span className="auth__name">{session.user.name ?? "Signed in"}</span>
      <SignOut />
    </div>
  );
}
