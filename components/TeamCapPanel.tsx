'use client';
import type { TeamResult } from '@/lib/cba/types';
import { SEASON_2026_27 as ACTIVE_SEASON } from '@/lib/cba/constants';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const TIER: Record<string, { label: string; color: string; hint: string }> = {
  below_cap: { label: 'Below cap', color: 'var(--tier-below)', hint: 'Under the salary cap — can absorb incoming salary into cap room without matching.' },
  over_cap: { label: 'Over cap', color: 'var(--tier-over)', hint: 'Over the cap but under the tax — trades must match salary within the matching brackets.' },
  over_tax: { label: 'Luxury tax', color: 'var(--tier-tax)', hint: 'Over the luxury-tax line — pays an escalating penalty on every dollar above it.' },
  first_apron: { label: '1st apron', color: 'var(--tier-apron1)', hint: 'Over the first apron — take-back capped at 100% and several tools (S&T, full MLE, BAE) are unavailable.' },
  second_apron: { label: '2nd apron', color: 'var(--tier-apron2)', hint: 'Over the second apron — cannot aggregate salaries, use trade exceptions, or send/receive cash; a future first is frozen.' },
};

function Space({ label, value, hint }: { label: string; value: number; hint: string }) {
  const over = value < 0;
  return (
    <div className="flex cursor-help flex-col items-start" title={`${hint} ${over ? `Currently over by ${m(-value)}.` : `${m(value)} of room.`}`}>
      <span className="text-[9px] uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <span className="num text-[11px] font-semibold" style={{ color: over ? 'var(--illegal)' : 'var(--legal)' }}>
        {over ? '-' : ''}
        {m(Math.abs(value))}
      </span>
    </div>
  );
}

export function TeamCapPanel({ result }: { result?: TeamResult }) {
  if (!result) return null;
  const cap = ACTIVE_SEASON;
  const apron = result.apronPostSalary ?? result.postSalary;
  const max = cap.secondApron * 1.06;
  const pct = Math.min(100, (result.postSalary / max) * 100);
  const tier = TIER[result.postTier];
  const delta = result.incoming - result.outgoing;
  const mark = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span
          title={tier.hint}
          className="cursor-help rounded px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: tier.color, backgroundColor: `color-mix(in srgb, ${tier.color} 16%, transparent)` }}
        >
          {tier.label}
        </span>
        <div className="text-right">
          <span className="num text-base font-semibold text-[var(--text)]" title="Projected team salary after this trade">{m(result.postSalary)}</span>
          {delta !== 0 && (
            <span className="num ml-1 text-[11px]" style={{ color: delta > 0 ? 'var(--illegal)' : 'var(--legal)' }}>
              {delta > 0 ? '▲' : '▼'}
              {m(Math.abs(delta))}
            </span>
          )}
          {apron !== result.postSalary && (
            <div className="num text-[10px] text-[var(--faint)]">Apron {m(apron)}</div>
          )}
        </div>
      </div>

      <div
        className="relative mt-2 h-2 w-full cursor-help overflow-hidden rounded-full bg-[var(--surface-2)]"
        title={`Team salary vs the four lines. Marks: tax ${m(cap.taxLine)} · 1st apron ${m(cap.firstApron)} · 2nd apron ${m(cap.secondApron)}.`}
      >
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: tier.color }} />
        {[cap.taxLine, cap.firstApron, cap.secondApron].map((v) => (
          <div key={v} className="absolute top-0 h-full w-px bg-[var(--bg)]/70" style={{ left: mark(v) }} />
        ))}
      </div>

      {/* Fanspo-parity: four distance-to-line meters (cap & tax off cap salary; aprons off apron salary) */}
      <div className="mt-2 grid grid-cols-4 gap-1">
        <Space label="Cap" value={cap.salaryCap - result.postSalary} hint="Distance to the salary cap." />
        <Space label="Tax" value={cap.taxLine - result.postSalary} hint="Distance to the luxury-tax line." />
        <Space label="Apron 1" value={cap.firstApron - apron} hint="Distance to the first apron (apron-basis salary)." />
        <Space label="Apron 2" value={cap.secondApron - apron} hint="Distance to the second apron (apron-basis salary)." />
      </div>
    </div>
  );
}
