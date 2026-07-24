import Image from "next/image";
import { auth, signIn, signOut } from "@/auth";

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

  return (
    <div className="auth">
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
