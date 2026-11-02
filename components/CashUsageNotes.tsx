import type { TradeTeamInput } from '@/lib/cba/types';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function CashUsageNotes({ team, season }: { team?: TradeTeamInput; season: string }) {
  const usage = team?.cashUsage?.season === season ? team.cashUsage : undefined;
  return <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
    {season} prior cash assumptions: sent {usage?.sent === undefined ? 'unknown' : dollars.format(usage.sent)}; received {usage?.received === undefined ? 'unknown' : dollars.format(usage.received)}. User-entered history, before this proposal.
  </p>;
}
