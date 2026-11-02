'use client';
import { useState } from 'react';
import { DATA_AS_OF, RECENT_TRANSACTIONS } from '@/lib/data/freshness';

const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function DataFreshness({ source }: { source: 'database' | 'snapshot' }) {
  const [open, setOpen] = useState(false);
  const pending = RECENT_TRANSACTIONS.filter((t) => !t.reflected).length;

  return (
    <div className="panel rounded-xl px-3.5 py-2.5 text-[12px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Bundled roster snapshot</span>
        <span className="num font-semibold text-[var(--text)]">{fmt(DATA_AS_OF)}</span>
        {pending > 0 && (
          <span className="rounded bg-[var(--warn)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warn)]">
            {pending} move{pending > 1 ? 's' : ''} pending curation
          </span>
        )}
        <span className="ml-auto text-[11px] text-[var(--muted)]">{open ? '▾' : '▸'} Snapshot notes</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
          {RECENT_TRANSACTIONS.map((t, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="num shrink-0 pt-0.5 text-[10px] text-[var(--faint)]">{fmt(t.date)}</span>
              <span
                className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-bold uppercase tracking-wide ${
                  t.reflected ? 'bg-[var(--legal)]/20 text-[var(--legal)]' : 'bg-[var(--warn)]/20 text-[var(--warn)]'
                }`}
                title={t.reflected ? 'Applied to the bundled snapshot; database sync is not verified here' : 'Reported, not yet curated into the snapshot'}
              >
                {t.reflected ? 'in snapshot' : 'pending'}
              </span>
              {t.status === 'pending' && (
                <span className="mt-0.5 shrink-0 rounded bg-[var(--info)]/20 px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--info)]">unofficial</span>
              )}
              <span className="text-[var(--muted)]">{t.summary}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--faint)]">
        {source === 'database'
          ? 'Database mode: the latest sync has not been verified. Snapshot notes do not confirm which moves are in the database.'
          : 'Using the bundled roster snapshot. Later moves may be missing; check player teams and pick ownership before sharing.'}
      </p>
    </div>
  );
}
