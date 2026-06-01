'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { TradeMatrix } from './TradeMatrix';
import { SeasonSelector } from './SeasonSelector';
import type { DbTeam, RosterEntry, ContractYear } from '@/lib/data/types';

export function TradeBoard({
  teams,
  rosters,
  seasons,
}: {
  teams: DbTeam[];
  rosters: Record<string, RosterEntry[]>;
  seasons: string[];
}) {
  const storeTeams = useTradeStore((s) => s.teams);
  const addTeam = useTradeStore((s) => s.addTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const [contracts, setContracts] = useState<Record<string, ContractYear[]>>({});

  const teamMeta = useMemo(() => Object.fromEntries(teams.map((t) => [t.abbr, t])), [teams]);

  function add(team: DbTeam) {
    const roster = rosters[team.abbr] ?? [];
    addTeam({ abbr: team.abbr, preTradeSalary: roster.reduce((s, r) => s + r.salary, 0) });
    const cmap: Record<string, ContractYear[]> = {};
    roster.forEach((r) => {
      const id = `${team.abbr}-${r.playerId}`;
      addAsset({ id, kind: 'player', salary: r.salary, fromTeam: team.abbr, toTeam: team.abbr, label: r.name });
      cmap[id] = r.contract;
    });
    setContracts((c) => ({ ...c, ...cmap }));
  }

  useEffect(() => () => useTradeStore.getState().reset(), []);

  const withData = teams.filter((t) => (rosters[t.abbr]?.length ?? 0) > 0);
  const available = withData.filter((t) => !storeTeams.some((s) => s.abbr === t.abbr));
  const atMax = storeTeams.length >= 4;

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl p-3.5">
        <SeasonSelector seasons={seasons} />
        <div className="h-5 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Add teams {storeTeams.length}/4
          </span>
          <div className="flex flex-wrap gap-1.5">
            {available.map((t) => (
              <button
                key={t.id}
                onClick={() => add(t)}
                disabled={atMax}
                className="group relative overflow-hidden rounded-md px-2.5 py-1 font-display text-sm font-semibold tracking-wide text-white transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: t.primary_color ?? '#1f2937' }}
              >
                <span className="relative">+ {t.abbr}</span>
              </button>
            ))}
            {available.length === 0 && !atMax && (
              <span className="text-xs text-[var(--faint)]">No more seeded rosters available</span>
            )}
          </div>
        </div>
      </div>

      {storeTeams.length >= 2 ? (
        <TradeMatrix contracts={contracts} teamMeta={teamMeta} />
      ) : (
        <div className="panel flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
          <div className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text)]">
            Pick at least two teams
          </div>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
            Use the team buttons above to load rosters into the matrix, then route players and picks between them.
          </p>
        </div>
      )}
    </div>
  );
}
