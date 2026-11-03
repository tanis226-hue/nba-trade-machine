'use client';
import type { TeamResult } from '@/lib/cba/types';
import { SEASON_2026_27, SEASON_2025_26 } from '@/lib/cba/constants';
import { useTradeStore } from '@/lib/store/tradeStore';
import { compactMoney as m, exactMoney, signedMoney, signedExactMoney, distanceToLine } from '@/lib/trades/presentation';

const TIER: Record<string, { label: string; color: string; hint: string }> = {
  below_cap: { label: 'Below cap', color: 'var(--tier-below)', hint: 'Cap room may absorb incoming salary without matching outgoing salary.' },
  over_cap: { label: 'Over cap', color: 'var(--tier-over)', hint: 'Trades must fit the applicable salary-matching rules or an eligible exception.' },
  over_tax: { label: 'Luxury tax', color: 'var(--tier-tax)', hint: 'This payroll exceeds the tax line. The amount over the line is not the tax bill.' },
  first_apron: { label: '1st apron', color: 'var(--tier-apron1)', hint: 'Incoming salary cannot exceed outgoing salary. Other restrictions may apply; see the trade check.' },
  second_apron: { label: '2nd apron', color: 'var(--tier-apron2)', hint: 'Salary aggregation and sending cash are restricted. Exceptions and distant first-round picks also face restrictions.' },
};

export function TeamCapPanel({ result }: { result?: TeamResult }) {
  const season = useTradeStore(s => s.season);
  const team = useTradeStore(s => s.teams.find(t => t.abbr === result?.abbr));
  if (!result) return null;
  const cap = season === '2025-26' ? SEASON_2025_26 : SEASON_2026_27;
  const apron = result.apronPostSalary ?? result.postSalary;
  const before = team?.preTradeSalary ?? result.postSalary - result.incoming + result.outgoing;
  const delta = result.postSalary - before;
  const tier = TIER[result.postTier];
  const lines = [
    { label: 'Salary cap', limit: cap.salaryCap, salary: result.postSalary },
    { label: 'Tax line', limit: cap.taxLine, salary: result.postSalary },
    { label: '1st apron', limit: cap.firstApron, salary: apron },
    { label: '2nd apron', limit: cap.secondApron, salary: apron },
  ];
  return <div className="team-finances">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded px-2 py-1 text-xs font-semibold" style={{ color: tier.color, backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)` }}>{tier.label}</span>
      <span className="num text-xs font-semibold text-[var(--muted)]">{delta === 0 ? 'No salary change' : `${signedMoney(delta)} salary`}</span>
    </div>
    <p className="mt-2 text-xs text-[var(--muted)]">Team salary <span className="num block text-base font-semibold text-[var(--text)]">{m(before)} <span aria-label="after trade">→</span> {m(result.postSalary)}</span></p>
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      {lines.map(line => <div key={line.label}><dt className="text-[var(--muted)]">{line.label}</dt><dd className="num mt-0.5 font-semibold text-[var(--text)]">{distanceToLine(line.limit - line.salary)}</dd></div>)}
    </dl>
    <details className="mt-2 text-xs text-[var(--muted)]">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Exact amounts &amp; cap explanation</summary>
      <p className="mb-2 leading-relaxed">{tier.hint}</p>
      <dl className="space-y-2">
        <div className="flex justify-between gap-3"><dt>Salary before</dt><dd className="num">{exactMoney(before)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Salary after</dt><dd className="num">{exactMoney(result.postSalary)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Salary change</dt><dd className="num">{signedExactMoney(delta)}</dd></div>
        {apron !== result.postSalary && <div className="flex justify-between gap-3"><dt>Apron-basis salary after</dt><dd className="num">{exactMoney(apron)}</dd></div>}
        {lines.map(line => <div key={line.label} className="border-t border-[var(--border-soft)] pt-2"><dt>{line.label}: <span className="num">{exactMoney(line.limit)}</span></dt><dd className="num mt-0.5">{distanceToLine(line.limit - line.salary, true)}</dd></div>)}
        {result.hardCapLine != null && <div className="border-t border-[var(--border-soft)] pt-2"><dt>Hard-cap limit: {exactMoney(result.hardCapLine)}</dt><dd className="mt-0.5 font-semibold" style={{ color: apron > result.hardCapLine ? 'var(--illegal)' : 'var(--text)' }}>{distanceToLine(result.hardCapLine - apron, true)}</dd></div>}
      </dl>
      <p className="mt-3 leading-relaxed">Cap and tax distances use team salary; apron distances use apron-basis salary. Cash exchanged does not provide salary matching or cap relief. These figures do not show a luxury-tax bill.</p>
    </details>
  </div>;
}
