'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTradeStore, MAX_TRADE_TEAMS } from '@/lib/store/tradeStore';
import { TradeMatrix } from './TradeMatrix';
import { SeasonSelector } from './SeasonSelector';
import { computeTeamSalary } from '@/lib/cba/teamSalary';
import { SEASON_2026_27 as ACTIVE_SEASON } from '@/lib/cba/constants';
import type { DbTeam, RosterEntry, ContractYear, DbDraftPick } from '@/lib/data/types';
import type { PlayerValueMap, FreeAgentRow, TeamExceptionView } from '@/lib/data/queries';
import type { FreeAgent } from '@/lib/store/tradeStore';
import { normalizePlayerId } from '@/lib/slug';
import { restrictionFor } from '@/lib/data/tradeRestrictions';
import { comparePlayers } from '@/lib/store/tradeStore';

export function TradeBoard({
  teams,
  rosters,
  seasons,
  picks,
  values,
  freeAgents = [],
  exceptions = {},
}: {
  teams: DbTeam[];
  rosters: Record<string, RosterEntry[]>;
  seasons: string[];
  picks: Record<string, DbDraftPick[]>;
  values: PlayerValueMap;
  freeAgents?: FreeAgentRow[];
  exceptions?: Record<string, TeamExceptionView[]>;
}) {
  const storeTeams = useTradeStore((s) => s.teams);
  const addTeam = useTradeStore((s) => s.addTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const [hydrated, setHydrated] = useState(false);

  // Per-player contract years for cap-sheet display, derived purely from the teams in the store and
  // the server rosters. Deriving (not storing) means a board restored from localStorage rebuilds its
  // contracts for free - no effect, no setState, no stale map after a refresh. Keyed by the player's
  // origin id (`${team.abbr}-${playerId}`) so lookups hold even after the asset is routed elsewhere.
  const contracts = useMemo<Record<string, ContractYear[]>>(() => {
    const map: Record<string, ContractYear[]> = {};
    for (const t of storeTeams) {
      for (const r of rosters[t.abbr] ?? []) {
        map[`${t.abbr}-${r.playerId}`] = r.contract;
      }
    }
    return map;
  }, [storeTeams, rosters]);

  // Enrich the free-agent pool with value/bio/headshot so the sign panel and resulting cards match rosters.
  const enrichedFreeAgents = useMemo<FreeAgent[]>(
    () =>
      freeAgents.map((fa) => {
        const v = values[fa.playerId] ?? values[normalizePlayerId(fa.playerId)];
        return {
          playerId: fa.playerId,
          name: fa.name,
          priorTeamId: fa.priorTeamId,
          priorSalary: fa.priorSalary,
          restricted: fa.restricted,
          value: v?.value,
          pts: v?.pts,
          reb: v?.reb,
          ast: v?.ast,
          age: v?.age ?? null,
          position: v?.position ?? null,
          height: v?.height ?? null,
          weight: v?.weight ?? null,
          jersey: v?.jersey ?? null,
          headshot: v?.headshot,
        };
      }),
    [freeAgents, values],
  );

  const teamMeta = useMemo(() => Object.fromEntries(teams.map((t) => [t.abbr, t])), [teams]);

  function add(team: DbTeam) {
    const roster = rosters[team.abbr] ?? [];
    const sal = computeTeamSalary(roster.map((r) => r.salary), ACTIVE_SEASON);
    const teamPicks = picks[team.abbr] ?? [];
    addTeam({
      abbr: team.abbr,
      preTradeSalary: sal.capSalary,
      apronSalary: sal.apronSalary,
      capSpace: sal.capSpace > 0 ? sal.capSpace : undefined, // cap-room matching path only when truly below cap
      ownedFirstRoundPicks: teamPicks.filter((p) => p.round === 1).map((p) => ({ year: Number(p.season), isSwap: p.is_swap })),
      exceptions: exceptions[team.id],
      // rosterCount intentionally omitted until Phase 1 dedupes scraped rosters to true active counts;
      // the raw scrape includes waived/expired rows, which would trip a spurious ROSTER_OVER block.
    });
    // Insert players in the current sort order (default salary high→low) so `order` reflects it.
    const cmp = comparePlayers(useTradeStore.getState().playerSort);
    const posOf = (r: RosterEntry) => (values[r.playerId] ?? values[normalizePlayerId(r.playerId)])?.position ?? undefined;
    const sortedRoster = [...roster].sort((a, b) =>
      cmp({ salary: a.salary, position: posOf(a) }, { salary: b.salary, position: posOf(b) }),
    );
    sortedRoster.forEach((r) => {
      const id = `${team.abbr}-${r.playerId}`;
      const cur = r.contract.find((c) => c.season === ACTIVE_SEASON.season) ?? r.contract[0];
      const v = values[r.playerId] ?? values[normalizePlayerId(r.playerId)];
      const restr = restrictionFor(r.playerId);
      // Over-38 rule: a 4+ year contract whose final year the player turns 38+ has its cap hit reallocated.
      const pAge = v?.age ?? r.age ?? null;
      const over38 = pAge != null && r.contract.length >= 4 && pAge + r.contract.length - 1 >= 38;
      addAsset({
        id,
        kind: 'player',
        salary: r.salary,
        origSalary: r.salary,
        fromTeam: team.abbr,
        toTeam: team.abbr,
        label: r.name,
        noTradeClause: cur?.no_trade_clause,
        isOver38: over38 || undefined,
        acquiredDate: restr?.acquiredDate,
        acquiredFrom: restr?.acquiredFrom,
        signedDate: restr?.signedDate,
        extendedDate: restr?.extendedDate,
        futureSalaries: r.contract.map((c) => ({ season: c.season, salary: c.salary })),
        value: v?.value,
        pts: v?.pts,
        reb: v?.reb,
        ast: v?.ast,
        age: v?.age ?? r.age ?? undefined,
        position: v?.position ?? undefined,
        height: v?.height ?? undefined,
        weight: v?.weight ?? undefined,
        jersey: v?.jersey ?? undefined,
        headshot: v?.headshot,
      });
    });
  }

  // Restore a board persisted in localStorage so a refresh or client navigation never wipes work
  // in progress. The store skips auto-hydration to avoid an SSR mismatch; we rehydrate after mount.
  // `contracts` is derived, so the restored teams rebuild their cap sheets with no extra wiring.
  // Gate the first render on `hydrated` so a restored board never flashes the empty "add a team"
  // state for a frame before localStorage loads. The skeleton matches SSR (both pre-hydration), so
  // there is no React hydration mismatch.
  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useTradeStore.persist.onFinishHydration(finish);
    void useTradeStore.persist.rehydrate();
    if (useTradeStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  const withData = teams.filter((t) => (rosters[t.abbr]?.length ?? 0) > 0);
  const available = withData.filter((t) => !storeTeams.some((s) => s.abbr === t.abbr));
  const atMax = storeTeams.length >= MAX_TRADE_TEAMS;

  // Until localStorage rehydrates, render a neutral skeleton (matches the server-rendered output)
  // so a restored trade doesn't flicker through the empty state.
  if (!hydrated) {
    return (
      <div className="space-y-5">
        <div className="panel h-[58px] animate-pulse rounded-xl" />
        <div className="panel ticked h-64 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl p-3.5">
        <SeasonSelector seasons={seasons} />
        <div className="h-5 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Add teams {storeTeams.length}/{MAX_TRADE_TEAMS}
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
        {storeTeams.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--legal)]" /> Auto-saved
            </span>
            <button
              onClick={() => {
                if (confirm('Clear this trade and start a new one? This cannot be undone.'))
                  useTradeStore.getState().reset();
              }}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--illegal)]/60 hover:text-[var(--illegal)]"
            >
              New trade
            </button>
          </div>
        )}
      </div>

      {storeTeams.length >= 1 ? (
        <TradeMatrix contracts={contracts} teamMeta={teamMeta} picks={picks} freeAgents={enrichedFreeAgents} />
      ) : (
        <div className="panel ticked flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
          <div className="eyebrow mb-2">Roster · cap · draft capital</div>
          <div className="font-display text-3xl font-bold uppercase tracking-wide text-[var(--text)]">
            Add a team to begin
          </div>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
            Load one team to inspect its roster, cap sheet, and draft capital, then add a second to build and
            validate a trade.
          </p>
        </div>
      )}
    </div>
  );
}
