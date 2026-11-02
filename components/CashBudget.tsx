'use client';

import { useTradeStore } from '@/lib/store/tradeStore';
import { CASH_LIMIT_2025_26, CASH_LIMIT_2026_27 } from '@/lib/cba/constants';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Prior transactions are explicit assumptions; a blank allowance is never treated as zero. */
export function CashBudget({ abbr }: { abbr: string }) {
  const team = useTradeStore(s => s.teams.find(t => t.abbr === abbr));
  const season = useTradeStore(s => s.season);
  const assets = useTradeStore(s => s.assets);
  const setTeamFlags = useTradeStore(s => s.setTeamFlags);
  if (!team) return null;
  const cash = Object.values(assets).filter(a => a.kind === 'cash' && (a.fromTeam === abbr || a.toTeam === abbr));
  if (!cash.length) return null;
  const moved = cash.filter(a => a.fromTeam !== a.toTeam && Number.isSafeInteger(a.amount) && (a.amount ?? 0) > 0);
  const limit = Math.floor(season === '2025-26' ? CASH_LIMIT_2025_26 : CASH_LIMIT_2026_27);
  const usage = team.cashUsage?.season === season ? team.cashUsage : undefined;
  function update(direction: 'sent' | 'received', value: string) {
    const next = value === '' ? undefined : Number(value);
    if (next !== undefined && (!Number.isSafeInteger(next) || next < 0 || next > 2_000_000_000)) return;
    setTeamFlags(abbr, { cashUsage: { season, ...usage, [direction]: next } });
  }
  return <details className="border-t border-[var(--border-soft)] px-3 py-3 text-xs">
    <summary className="cursor-pointer font-semibold">Cash allowances · {season}</summary>
    <p className="mt-2 text-[var(--muted)]">Enter cash already exchanged this cap year, including reimbursements. Blank means unknown; enter 0 only if none. These are your assumptions.</p>
    <p className="mt-2 text-[var(--muted)]">Maximum whole-dollar allowance: {dollars.format(limit)} each way. Sending cash also triggers the second-apron hard cap.</p>
    <div className="mt-3 grid gap-3">
      {(['sent', 'received'] as const).map(direction => {
        const prior = usage?.[direction];
        const proposed = moved.filter(a => direction === 'sent' ? a.fromTeam === abbr : a.toTeam === abbr).reduce((sum, a) => sum + (a.amount ?? 0), 0);
        const remaining = prior === undefined ? undefined : limit - prior - proposed;
        const inputId = `cash-${abbr}-${direction}`;
        return <div key={direction}>
          <label htmlFor={inputId} className="mb-1 block font-medium">Already {direction} before this deal (USD)</label>
          <input id={inputId} aria-label={`${abbr} cash already ${direction}`} className="ui-input w-full" type="number" min={0} max={2_000_000_000} step={1} inputMode="numeric" placeholder="Unknown" value={prior ?? ''} onChange={event => update(direction, event.target.value)}/>
          <p className="mt-1 text-[var(--muted)]">This deal: {dollars.format(proposed)} · {remaining === undefined ? 'Remaining allowance unknown' : remaining < 0 ? `${dollars.format(-remaining)} over allowance` : `${dollars.format(remaining)} left after deal`}</p>
        </div>;
      })}
    </div>
    <p className="mt-2 text-[var(--muted)]">Sent and received limits are separate. Cash does not count toward salary matching or payroll.</p>
  </details>;
}
