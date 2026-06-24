'use client';
import { useEffect, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset } from '@/lib/cba/types';

const m = (n?: number) => (n == null ? '—' : `$${(n / 1_000_000).toFixed(1)}M`);

// Highlight the best value per stat row across the compared players.
function bestIndex(vals: (number | undefined)[]): number {
  let bi = -1;
  let bv = -Infinity;
  vals.forEach((v, i) => {
    if (v != null && v > bv) {
      bv = v;
      bi = i;
    }
  });
  return bi;
}

const STAT_ROWS: { key: keyof TradeAsset; label: string; fmt?: (v: number) => string; higherBetter?: boolean }[] = [
  { key: 'salary', label: 'Salary', fmt: (v) => m(v), higherBetter: false },
  { key: 'value', label: 'Game Score', higherBetter: true },
  { key: 'pts', label: 'PTS', higherBetter: true },
  { key: 'reb', label: 'REB', higherBetter: true },
  { key: 'ast', label: 'AST', higherBetter: true },
];

export function PlayerCompare() {
  const compareIds = useTradeStore((s) => s.compareIds);
  const assets = useTradeStore((s) => s.assets);
  const toggleCompare = useTradeStore((s) => s.toggleCompare);
  const clearCompare = useTradeStore((s) => s.clearCompare);
  const [open, setOpen] = useState(false);

  const players = compareIds.map((id) => assets[id]).filter(Boolean) as TradeAsset[];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (players.length === 0) return null;

  return (
    <>
      {/* sticky tray */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
        <div className="panel flex max-w-3xl flex-wrap items-center gap-2 rounded-xl px-3 py-2 shadow-xl ring-1 ring-[var(--accent-2)]/30">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">Compare</span>
          {players.map((p) => (
            <span key={p.id} className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text)]">
              {p.label}
              <button onClick={() => toggleCompare(p.id)} aria-label={`Remove ${p.label}`} className="text-[var(--faint)] hover:text-[var(--illegal)]">
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={() => setOpen(true)}
            disabled={players.length < 2}
            className="ml-1 rounded-lg bg-[var(--accent)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink)] transition enabled:hover:brightness-110 disabled:opacity-40"
            title={players.length < 2 ? 'Add another player (⊕ vs) to compare' : 'Open side-by-side comparison'}
          >
            Compare {players.length}
          </button>
          <button onClick={clearCompare} className="rounded px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
            Clear
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Player comparison"
            onClick={(e) => e.stopPropagation()}
            className="panel ticked relative max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between bg-[var(--accent)] px-4 py-2.5">
              <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Player comparison</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--ink)]/80 transition hover:text-[var(--ink)]">
                ✕
              </button>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[420px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="w-28 py-2 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Stat</th>
                    {players.map((p) => (
                      <th key={p.id} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Photo src={p.headshot} name={p.label} />
                          <span className="font-display text-[12px] font-bold uppercase leading-tight text-[var(--text)]">{p.label}</span>
                          <span className="text-[10px] text-[var(--faint)]">{p.fromTeam}{p.position ? ` · ${p.position}` : ''}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_ROWS.map((row) => {
                    const raw = players.map((p) => p[row.key] as number | undefined);
                    const cmp = row.higherBetter ? raw : raw.map((v) => (v == null ? undefined : -v));
                    const best = players.length > 1 ? bestIndex(cmp) : -1;
                    return (
                      <tr key={row.key} className="border-t border-[var(--border-soft)]">
                        <td className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{row.label}</td>
                        {players.map((p, i) => {
                          const v = raw[i];
                          return (
                            <td
                              key={p.id}
                              className={`num px-2 py-2 text-center ${i === best ? 'font-bold text-[var(--legal)]' : 'text-[var(--text)]'}`}
                            >
                              {v == null ? '—' : row.fmt ? row.fmt(v) : v}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="border-t border-[var(--border-soft)]">
                    <td className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Age</td>
                    {players.map((p) => (
                      <td key={p.id} className="num px-2 py-2 text-center text-[var(--text)]">
                        {p.age != null ? p.age : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-[var(--border-soft)]">
                    <td className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Bio</td>
                    {players.map((p) => (
                      <td key={p.id} className="px-2 py-2 text-center text-[11px] text-[var(--muted)]">
                        {[p.height, p.weight ? `${p.weight} lbs` : null].filter(Boolean).join(' · ') || '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-[var(--border-soft)]">
                    <td className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Future $</td>
                    {players.map((p) => (
                      <td key={p.id} className="px-2 py-2 text-center text-[11px] text-[var(--muted)]">
                        {p.futureSalaries && p.futureSalaries.length > 0
                          ? p.futureSalaries.map((f) => `${f.season.slice(2)} ${m(f.salary)}`).join(' · ')
                          : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Photo({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  if (!src || err) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]">
        {initials}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setErr(true)} className="h-12 w-12 rounded-full bg-[var(--surface-2)] object-cover object-top ring-1 ring-[var(--border)]" />;
}
