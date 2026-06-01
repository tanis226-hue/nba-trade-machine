'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';

export function GenerateLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);

  async function gen() {
    setBusy(true);
    try {
      const res = await fetch('/api/trade', { method: 'POST', body: JSON.stringify({ season, teams, assets }) });
      const { slug } = await res.json();
      setUrl(`${location.origin}/trade/${slug}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={gen} disabled={busy} className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 disabled:opacity-50">
        {busy ? 'Generating…' : 'Generate Trade Link'}
      </button>
      {url && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded border border-neutral-300 p-2 text-sm"
        />
      )}
    </div>
  );
}
