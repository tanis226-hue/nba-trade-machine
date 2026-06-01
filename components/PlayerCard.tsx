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
    <div className={`rounded border p-2 text-sm transition ${routed ? 'border-emerald-400 bg-emerald-50/60' : 'border-neutral-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium leading-tight">{asset.label}</span>
        <span className="shrink-0 tabular-nums text-neutral-700">{m(asset.salary)}</span>
      </div>
      {contract && contract.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-500">
          {contract.map((c) => (
            <span key={c.season} className="rounded bg-neutral-100 px-1">
              {c.season.slice(2)} {m(c.salary)}
              {OPT[c.option_type] ? ` ${OPT[c.option_type]}` : ''}
              {c.no_trade_clause ? ' · NTC' : ''}
            </span>
          ))}
        </div>
      )}
      <select
        value={asset.toTeam}
        onChange={(e) => routeAsset(asset.id, e.target.value)}
        className="mt-1.5 w-full rounded border border-neutral-200 px-1 py-0.5 text-xs"
        aria-label={`Send ${asset.label} to`}
      >
        <option value={asset.fromTeam}>Stay</option>
        {dests.map((t) => (
          <option key={t.abbr} value={t.abbr}>
            → {t.abbr}
          </option>
        ))}
      </select>
    </div>
  );
}
