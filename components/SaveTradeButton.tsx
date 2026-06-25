'use client';
import { useState } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useTradeStore } from '@/lib/store/tradeStore';

// "Save to my account" — persists the current board to Neon under the signed-in Clerk user, so it
// shows up in /my-trades and follows them across devices. Sends simulatedDate + tradeMethod too, so
// a reopened trade re-validates exactly as the author saw it. Only mounted when Clerk is configured.
export function SaveTradeButton() {
  const { isSignedIn } = useUser();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const simulatedDate = useTradeStore((s) => s.simulatedDate);
  const tradeMethod = useTradeStore((s) => s.tradeMethod);

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]">
          Sign in to save
        </button>
      </SignInButton>
    );
  }

  async function save() {
    const title = (prompt('Name this trade', 'My trade') ?? '').trim();
    if (!title) return;
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch('/api/trade/save', {
        method: 'POST',
        body: JSON.stringify({ title, season, teams, assets, simulatedDate, tradeMethod }),
      });
      if (res.ok) {
        const { slug } = await res.json();
        setSaved(slug);
        setTimeout(() => setSaved(null), 2000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      className="w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/10 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-50"
    >
      {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save to my account'}
    </button>
  );
}
