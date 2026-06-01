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
  const assetsMap = useTradeStore((s) => s.assets);
  const teams = useTradeStore((s) => s.teams);
  const removeTeam = useTradeStore((s) => s.removeTeam);
  const assets = Object.values(assetsMap);
  const own = assets.filter((a) => a.fromTeam === abbr);
  const incoming = assets.filter((a) => a.toTeam === abbr && a.fromTeam !== abbr);
  const color = meta?.primary_color ?? '#334155';
  const color2 = meta?.secondary_color ?? color;

  return (
    <div className="panel flex w-[290px] flex-col overflow-hidden rounded-xl">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color2})` }} />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md font-display text-sm font-bold text-white shadow-inner"
          style={{ background: `linear-gradient(135deg, ${color}, ${color2})` }}
        >
          {abbr}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text)]">{abbr}</div>
          {meta && <div className="truncate text-[11px] text-[var(--muted)]">{meta.name}</div>}
        </div>
        <button
          onClick={() => removeTeam(abbr)}
          className="ml-auto rounded p-1 text-[var(--faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--illegal)]"
          aria-label={`Remove ${abbr}`}
        >
          ✕
        </button>
      </div>

      <div className="border-t border-[var(--border-soft)] px-3 py-3">
        <TeamCapPanel result={result} />
      </div>

      <div className="flex-1 px-3 pb-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">Roster</div>
        <div className="space-y-1.5">
          {own.map((a) => (
            <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />
          ))}
          {own.length === 0 && <div className="text-xs text-[var(--faint)]">All players traded away</div>}
        </div>

        {incoming.length > 0 && (
          <>
            <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--legal)]">
              Incoming
            </div>
            <div className="space-y-1.5">
              {incoming.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--legal)]/30 bg-[var(--legal)]/8 px-2.5 py-1.5 text-sm text-[var(--text)]"
                >
                  <span className="truncate">{a.label}</span>
                  {a.salary > 0 && <span className="num shrink-0 text-xs text-[var(--muted)]">${(a.salary / 1_000_000).toFixed(1)}M</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
