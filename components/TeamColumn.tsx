'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import { PlayerCard } from './PlayerCard';
import { TeamCapPanel } from './TeamCapPanel';
import type { TeamResult } from '@/lib/cba/types';
import type { ContractYear, DbTeam } from '@/lib/data/types';

export function TeamColumn({
  abbr,
  meta,
  result,
  contracts,
}: {
  abbr: string;
  meta?: DbTeam;
  result?: TeamResult;
  contracts: Record<string, ContractYear[]>;
}) {
  const assets = useTradeStore((s) => Object.values(s.assets));
  const teams = useTradeStore((s) => s.teams);
  const removeTeam = useTradeStore((s) => s.removeTeam);
  const own = assets.filter((a) => a.fromTeam === abbr);
  const incoming = assets.filter((a) => a.toTeam === abbr && a.fromTeam !== abbr);
  const color = meta?.primary_color ?? '#1f2937';

  return (
    <div className="flex-1 min-w-[260px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 text-white" style={{ backgroundColor: color }}>
        <div className="leading-tight">
          <div className="font-bold">{abbr}</div>
          {meta && <div className="text-[11px] opacity-80">{meta.name}</div>}
        </div>
        <button
          onClick={() => removeTeam(abbr)}
          className="rounded px-1 text-sm text-white/80 hover:bg-white/20"
          aria-label={`Remove ${abbr}`}
        >
          ✕
        </button>
      </div>
      <div className="p-3">
        <TeamCapPanel result={result} />
        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Roster</div>
        <div className="space-y-1">
          {own.map((a) => (
            <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />
          ))}
        </div>
        {incoming.length > 0 && <div className="mt-3 text-[11px] uppercase tracking-wide text-emerald-600">Incoming</div>}
        <div className="space-y-1">
          {incoming.map((a) => (
            <div key={a.id} className="rounded bg-emerald-50 px-2 py-1 text-sm">
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
