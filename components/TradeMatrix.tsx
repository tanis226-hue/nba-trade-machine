'use client';
import { useMemo } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { selectValidation } from '@/lib/store/selectValidation';
import { TeamColumn } from './TeamColumn';
import { ValidationFeed } from './ValidationFeed';
import { ExecuteTradeButton } from './ExecuteTradeButton';
import { GenerateLinkButton } from './GenerateLinkButton';
import type { ContractYear, DbTeam } from '@/lib/data/types';

export function TradeMatrix({
  contracts,
  teamMeta,
}: {
  contracts: Record<string, ContractYear[]>;
  teamMeta: Record<string, DbTeam>;
}) {
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const validation = useMemo(() => selectValidation({ season, teams, assets }), [season, teams, assets]);
  const byTeam = useMemo(() => Object.fromEntries(validation.perTeam.map((t) => [t.abbr, t])), [validation]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto snap-x pb-2">
        {teams.map((t) => (
          <div key={t.abbr} className="snap-start">
            <TeamColumn abbr={t.abbr} meta={teamMeta[t.abbr]} result={byTeam[t.abbr]} contracts={contracts} />
          </div>
        ))}
      </div>
      <ValidationFeed validation={validation} />
      <ExecuteTradeButton valid={validation.valid && teams.length >= 2} onExecute={() => { /* Phase 5 interstitial */ }} />
      <GenerateLinkButton />
    </div>
  );
}
