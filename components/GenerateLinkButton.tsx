'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';

export function GenerateLinkButton() {
  const [result, setResult] = useState<{url:string;key:string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const simulatedDate = useTradeStore((s) => s.simulatedDate);
  const tradeMethod = useTradeStore((s) => s.tradeMethod);
  const key=JSON.stringify({season,teams,assets,simulatedDate,tradeMethod});
  const url=result?.key===key?result.url:null;

  async function gen() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ season, teams, assets, simulatedDate, tradeMethod }),
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok || typeof data.slug!=='string' || !/^[A-Za-z0-9_-]{10}$/.test(data.slug)) throw new Error(data.error??'Could not create a link. Please try again.');
      const {slug}=data;
      const link = `${location.origin}/trade/${slug}`;
      setResult({url:link,key});
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    } catch(error) {
      setError(error instanceof Error?error.message:'Could not create a link. Please try again.');
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
        {busy ? 'Generating…' : copied && url ? 'Link copied ✓' : 'Generate Trade Link'}
      </button>
      {url && (
        <input
          readOnly
          aria-label="Trade link"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="num w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--muted)] outline-none"
        />
      )}
      {error && <p role="alert" className="text-xs text-[var(--illegal)]">{error}</p>}
    </div>
  );
}
