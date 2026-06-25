import { auth } from '@clerk/nextjs/server';
import { SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { listUserTrades } from '@/lib/data/queries';
import { authEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="rise space-y-5">
      <div className="stagger">
        <div className="eyebrow flex items-center gap-2.5">
          <span className="h-px w-8 bg-[var(--accent)]" /> Your saved trades
        </div>
        <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.85] tracking-tight text-[var(--text)] sm:text-6xl">
          My Trades
        </h1>
      </div>
      {children}
    </main>
  );
}

export default async function MyTrades() {
  if (!authEnabled) {
    return (
      <Shell>
        <p className="text-[14px] text-[var(--muted)]">Accounts are not enabled on this deployment.</p>
        <Link href="/" className="inline-block font-display text-sm font-semibold uppercase tracking-wide text-[var(--accent)] hover:brightness-110">
          Back to the trade machine →
        </Link>
      </Shell>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <Shell>
        <p className="text-[14px] text-[var(--muted)]">Sign in to see the trades you&rsquo;ve saved.</p>
        <SignInButton mode="modal">
          <button className="inline-block rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
            Sign in
          </button>
        </SignInButton>
      </Shell>
    );
  }

  const trades = await listUserTrades(userId);

  return (
    <Shell>
      {trades.length === 0 ? (
        <div className="panel ticked flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
          <div className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text)]">No saved trades yet</div>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
            Build a deal, then hit <span className="font-semibold text-[var(--accent)]">Save to my account</span> to keep it here.
          </p>
          <Link href="/" className="mt-4 inline-block font-display text-sm font-semibold uppercase tracking-wide text-[var(--accent)] hover:brightness-110">
            Build a trade →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {trades.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/trade/${t.slug}`}
                className="panel flex items-center justify-between gap-3 rounded-xl p-4 transition hover:border-[var(--accent)]/60"
              >
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-semibold text-[var(--text)]">{t.title}</div>
                  <div className="num mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
                    {t.season}{t.updatedAt ? ` · ${when(t.updatedAt)}` : ''}
                  </div>
                </div>
                <span className="shrink-0 font-display text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
