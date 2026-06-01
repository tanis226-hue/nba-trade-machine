'use client';
import type { TeamResult } from '@/lib/cba/types';
import { SEASON_2025_26 } from '@/lib/cba/constants';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const TIER: Record<string, { label: string; cls: string }> = {
  below_cap: { label: 'Below cap', cls: 'bg-emerald-100 text-emerald-800' },
  over_cap: { label: 'Over cap', cls: 'bg-sky-100 text-sky-800' },
  over_tax: { label: 'Luxury tax', cls: 'bg-amber-100 text-amber-800' },
  first_apron: { label: '1st apron', cls: 'bg-orange-100 text-orange-800' },
  second_apron: { label: '2nd apron', cls: 'bg-red-100 text-red-800' },
};

export function TeamCapPanel({ result }: { result?: TeamResult }) {
  if (!result) return null;
  const cap = SEASON_2025_26;
  const pct = Math.min(100, (result.postSalary / cap.secondApron) * 100);
  const tier = TIER[result.postTier];
  const delta = result.incoming - result.outgoing;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tier.cls}`}>{tier.label}</span>
        <span className="text-xs tabular-nums">
          {m(result.postSalary)}
          {delta !== 0 && (
            <span className={delta > 0 ? 'text-red-600' : 'text-emerald-600'}> ({delta > 0 ? '+' : ''}{m(delta)})</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-neutral-200">
        <div className="h-full rounded bg-neutral-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500">
        Tax {m(cap.taxLine)} · A1 {m(cap.firstApron)} · A2 {m(cap.secondApron)}
      </div>
    </div>
  );
}
