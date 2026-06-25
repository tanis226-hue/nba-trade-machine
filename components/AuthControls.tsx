import { auth } from '@clerk/nextjs/server';
import { SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

// Header auth cluster. Server component so it can branch on auth() without shipping the session to
// the client. Only rendered when Clerk is configured (see lib/auth.authEnabled), so auth() always
// has the middleware context it needs.
export async function AuthControls() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <SignInButton mode="modal">
        <button className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]">
          Sign in
        </button>
      </SignInButton>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Link
        href="/my-trades"
        className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
      >
        My trades
      </Link>
      <UserButton />
    </div>
  );
}
