'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';

export function GenerateLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const simulatedDate = useTradeStore((s) => s.simulatedDate);
  const tradeMethod = useTradeStore((s) => s.tradeMethod);

  async function gen() {
    setBusy(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        body: JSON.stringify({ season, teams, assets, simulatedDate, tradeMethod }),
      });
      const { slug } = await res.json();
      const link = `${location.origin}/trade/${slug}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={gen}
        disabled={busy}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] disabled:opacity-50"
      >
        {busy ? 'Generating…' : copied ? 'Link copied ✓' : 'Generate Trade Link'}
      </button>
      {url && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="num w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--muted)] outline-none"
        />
      )}
    </div>
  );
}
