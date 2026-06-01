'use client';
import type { TeamResult } from '@/lib/cba/types';
import { SEASON_2025_26 } from '@/lib/cba/constants';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const TIER: Record<string, { label: string; color: string }> = {
  below_cap: { label: 'Below cap', color: '#2fd17a' },
  over_cap: { label: 'Over cap', color: '#38bdf8' },
  over_tax: { label: 'Luxury tax', color: '#ffb000' },
  first_apron: { label: '1st apron', color: '#ff7a1f' },
  second_apron: { label: '2nd apron', color: '#ff5347' },
};

export function TeamCapPanel({ result }: { result?: TeamResult }) {
  if (!result) return null;
  const cap = SEASON_2025_26;
  const max = cap.secondApron * 1.06;
  const pct = Math.min(100, (result.postSalary / max) * 100);
  const tier = TIER[result.postTier];
  const delta = result.incoming - result.outgoing;
  const mark = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span
          className="rounded px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: tier.color, backgroundColor: `${tier.color}1f` }}
        >
          {tier.label}
        </span>
        <div className="text-right">
          <span className="num text-base font-semibold text-[var(--text)]">{m(result.postSalary)}</span>
          {delta !== 0 && (
            <span className="num ml-1 text-[11px]" style={{ color: delta > 0 ? 'var(--illegal)' : 'var(--legal)' }}>
              {delta > 0 ? '▲' : '▼'}{m(Math.abs(delta))}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: tier.color }} />
        {[cap.taxLine, cap.firstApron, cap.secondApron].map((v) => (
          <div key={v} className="absolute top-0 h-full w-px bg-[var(--bg)]/70" style={{ left: mark(v) }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-[var(--faint)]">
        <span>Tax {m(cap.taxLine)}</span>
        <span>A1 {m(cap.firstApron)}</span>
        <span>A2 {m(cap.secondApron)}</span>
      </div>
    </div>
  );
}
