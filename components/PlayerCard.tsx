'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const OPT: Record<string, string> = { team: 'TO', player: 'PO', eto: 'ETO', guaranteed: '', non_guaranteed: 'NG', two_way: '2W' };

export function PlayerCard({ asset, contract, teams }: { asset: TradeAsset; contract?: ContractYear[]; teams: TradeTeamInput[] }) {
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const dests = teams.filter((t) => t.abbr !== asset.fromTeam);
  const routed = asset.toTeam !== asset.fromTeam;

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 transition ${
        routed ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8' : 'border-[var(--border-soft)] bg-[var(--surface-2)]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-[var(--text)]">{asset.label}</span>
        <span className="num shrink-0 text-[13px] font-semibold text-[var(--text)]">{m(asset.salary)}</span>
      </div>

      {contract && contract.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {contract.map((c) => (
            <span key={c.season} className="num rounded bg-[var(--bg)]/60 px-1 text-[10px] text-[var(--muted)]">
              {c.season.slice(2)} {m(c.salary)}
              {OPT[c.option_type] ? ` ${OPT[c.option_type]}` : ''}
              {c.no_trade_clause ? ' NTC' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          onClick={() => routeAsset(asset.id, asset.fromTeam)}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
            !routed ? 'bg-[var(--surface-2)] text-[var(--muted)]' : 'text-[var(--faint)] hover:bg-[var(--surface-2)]'
          }`}
        >
          Stay
        </button>
        {dests.map((t) => {
          const active = asset.toTeam === t.abbr;
          return (
            <button
              key={t.abbr}
              onClick={() => routeAsset(asset.id, t.abbr)}
              className={`rounded px-1.5 py-0.5 font-display text-[11px] font-semibold tracking-wide transition ${
                active ? 'bg-[var(--accent)] text-black' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              → {t.abbr}
            </button>
          );
        })}
      </div>
    </div>
  );
}
