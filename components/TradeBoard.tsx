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

  const available = teams.filter((t) => (rosters[t.abbr]?.length ?? 0) > 0 && !storeTeams.some((s) => s.abbr === t.abbr));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeasonSelector seasons={seasons} />
        <div className="flex flex-wrap gap-2">
          {available.map((t) => (
            <button
              key={t.id}
              onClick={() => add(t)}
              disabled={storeTeams.length >= 4}
              className="rounded-lg border px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: t.primary_color ?? '#1f2937' }}
            >
              + {t.abbr}
            </button>
          ))}
        </div>
      </div>
      {storeTeams.length >= 2 ? (
        <TradeMatrix contracts={contracts} teamMeta={teamMeta} />
      ) : (
        <p className="text-neutral-500">Add at least two teams to start building a trade.</p>
      )}
    </div>
  );
}
