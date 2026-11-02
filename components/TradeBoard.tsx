'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTradeStore, MAX_TRADE_TEAMS } from '@/lib/store/tradeStore';
import { TradeMatrix } from './TradeMatrix';
import { TeamLogo } from './TeamLogo';
import { ConfirmDialog } from './ConfirmDialog';
import { SeasonSelector } from './SeasonSelector';
import { computeTeamSalary } from '@/lib/cba/teamSalary';
import { SEASON_2026_27,SEASON_2025_26 } from '@/lib/cba/constants';
import type { DbTeam, RosterEntry, ContractYear, DbDraftPick,RosterSnapshot } from '@/lib/data/types';
import type { PlayerValueMap, FreeAgentRow, TeamExceptionView, ProjectedRecord } from '@/lib/data/queries';
import type { FreeAgent } from '@/lib/store/tradeStore';
import { normalizePlayerId } from '@/lib/slug';
import { restrictionFor } from '@/lib/data/tradeRestrictions';
import { comparePlayers } from '@/lib/store/tradeStore';

export function TradeBoard({
  teams,
  rosters,
  seasons,
  rosterSeason='2026-27',
  payroll,
  dataVersion='historical-2026-06-01',
  defaultDate='2026-06-01',
  picks,
  values,
  freeAgents = [],
  exceptions = {},
  projectedRecords = {},
}: {
  teams: DbTeam[];
  rosters: Record<string, RosterEntry[]>;
  seasons: string[];
  rosterSeason?:string;
  payroll?:RosterSnapshot['teams'];
  dataVersion?:string;
  defaultDate?:string;
  picks: Record<string, DbDraftPick[]>;
  values: PlayerValueMap;
  freeAgents?: FreeAgentRow[];
  exceptions?: Record<string, TeamExceptionView[]>;
  projectedRecords?: Record<string, ProjectedRecord>;
}) {
  const ACTIVE_SEASON=rosterSeason==='2025-26'?SEASON_2025_26:SEASON_2026_27;
  const storeTeams = useTradeStore((s) => s.teams);
  const capYear = useTradeStore((s) => s.season);
  const boardVersion=useTradeStore(s=>s.dataVersion);
  const stale=storeTeams.length>0&&boardVersion!==dataVersion;
  const addTeam = useTradeStore((s) => s.addTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const [hydrated, setHydrated] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamPickerOpen,setTeamPickerOpen]=useState(false);
  const [showAllTeams,setShowAllTeams]=useState(false);
  const [confirmation,setConfirmation]=useState<'new'|'current'|null>(null);
  const [removeTeam,setRemoveTeam]=useState<string|null>(null);

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
    if(useTradeStore.getState().season!==rosterSeason)return;
    const roster = rosters[team.abbr] ?? [];
    const reported=payroll?.[team.id];
    const sal = computeTeamSalary(roster.map((r) => r.salary), ACTIVE_SEASON);
    const teamPicks = picks[team.abbr] ?? [];
    addTeam({
      abbr: team.abbr,
      preTradeSalary: reported?.preTradeSalary??sal.capSalary,
      apronSalary: reported?.apronSalary??sal.apronSalary,
      capSpace: reported?reported.capSpace:sal.capSpace>0?sal.capSpace:undefined,
      hardCapLine:reported?.hardCapLine,
      rosterCount:reported?.rosterCount,
      twoWayCount:reported?.twoWayCount,
      dataNotes:reported?.dataNotes,
      pickOwnershipUncertain:teamPicks.some(p=>p.round===1&&p.needsReview),
      ownedFirstRoundPicks: [
        ...teamPicks.filter((p) => p.round === 1).map((p) => ({ id:p.id,year: Number(p.season), isSwap: p.is_swap, conveyed: p.conveyed })),
        ...Array.from({length:7},(_,i)=>Number(rosterSeason.slice(0,4))+1+i).filter(year=>!teamPicks.some(p=>p.round===1&&Number(p.season)===year)).map(year=>({year,conveyed:true})),
      ],
      exceptions: exceptions[team.id],
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
        isTwoWay:r.isTwoWay,
        maxSalary:r.maxSalary,
        dataNotes:r.dataNotes,
        tradeBonusPct: cur?.trade_bonus_pct ?? undefined,
        tradeBonusEarned: cur?.trade_bonus_earned ?? undefined,
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
        age: r.age??v?.age??undefined,
        position: r.position??v?.position??undefined,
        height: r.height??v?.height??undefined,
        weight: r.weight??v?.weight??undefined,
        jersey: r.jersey??v?.jersey??undefined,
        headshot: r.headshot??v?.headshot,
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
    const finish = () => {
      if(useTradeStore.getState().season!==rosterSeason)useTradeStore.getState().setSeason(rosterSeason);
      const state=useTradeStore.getState();
      if(!state.teams.length) {
        state.setDataVersion(dataVersion);
        state.setSimulatedDate(defaultDate);
      } else if(!state.dataVersion) {
        state.setDataVersion('legacy-2026-07-13');
        if(!state.simulatedDate)state.setSimulatedDate('2026-07-13');
      }
      setHydrated(true);
    };
    const unsub = useTradeStore.persist.onFinishHydration(finish);
    void useTradeStore.persist.rehydrate();
    if (useTradeStore.persist.hasHydrated()) finish();
    return unsub;
  }, [rosterSeason,dataVersion,defaultDate]);

  const withData = teams.filter((t) => (rosters[t.abbr]?.length ?? 0) > 0);
  const available = withData.filter((t) => !storeTeams.some((s) => s.abbr === t.abbr));
  const query = teamSearch.trim().toLowerCase();
  const filteredTeams = available.filter((t) => `${t.name} ${t.abbr}`.toLowerCase().includes(query));
  const atMax = storeTeams.length >= MAX_TRADE_TEAMS;
  function startNewBoard() {
    const state=useTradeStore.getState();state.reset();state.setSeason(rosterSeason);
    state.setDataVersion(dataVersion);state.setSimulatedDate(defaultDate);
  }

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

  const pickerVisible=storeTeams.length<2||teamPickerOpen;
  const popular=['LAL','BOS','GSW','NYK','CHI','DAL'];
  const displayedTeams=query||showAllTeams?filteredTeams:filteredTeams.filter(t=>popular.includes(t.abbr));
  return (
    <div className="space-y-5">
      {stale&&<div role="status" className="panel rounded-xl border-[var(--warn)] p-4 text-sm">
        <strong>You’re editing a saved roster snapshot.</strong>
        <p className="mt-1 text-[var(--muted)]">Keep working with these teams, or start a fresh board to use current rosters.</p>
        <button className="ui-button mt-3" onClick={()=>setConfirmation('current')}>Load current rosters</button>
      </div>}
      <section className="panel team-setup" aria-labelledby="teams-heading">
        <div className="setup-heading">
          <div>
            <h2 id="teams-heading">{storeTeams.length===0?"Who's in your trade?":'Your teams'}</h2>
            {!storeTeams.length&&<p>Choose two teams to start. You can add more as your deal grows.</p>}
            {storeTeams.length===1&&<p>Add one more team to start moving players.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SeasonSelector seasons={seasons} />
            {storeTeams.length>0&&<button className="ui-button" onClick={()=>setConfirmation('new')}>New trade</button>}
          </div>
        </div>
        {storeTeams.length>0&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="selected-teams">
            {storeTeams.map(t=><span className="selected-team" key={t.abbr}><TeamLogo abbr={t.abbr} size={26}/>{t.abbr}<button aria-label={`Remove ${t.abbr} from trade`} onClick={()=>setRemoveTeam(t.abbr)}>×</button></span>)}
            {storeTeams.length>=2&&<button className="ui-button" aria-expanded={pickerVisible} aria-controls="team-picker" disabled={atMax||stale} onClick={()=>setTeamPickerOpen(v=>!v)}>{pickerVisible?'Close team picker':'+ Add team'}</button>}
          </div>
          <span className="text-xs text-[var(--muted)]">Saved in this browser <span className="ml-1 text-[var(--legal)]" aria-hidden="true">✓</span></span>
        </div>}
        {pickerVisible&&<div className="team-picker" id="team-picker">
          <div className="team-search-row">
            <label><span className="sr-only">Search teams</span><input className="ui-input" name="team-search" autoComplete="off" type="search" placeholder="Search city, team or abbreviation…" value={teamSearch} onChange={e=>setTeamSearch(e.target.value)}/></label>
            <span className="text-xs text-[var(--muted)]">{storeTeams.length}/{MAX_TRADE_TEAMS} teams</span>
          </div>
          <div className="team-picker-grid">
            {displayedTeams.map(t=><button className="team-option" key={t.id} aria-label={`Add ${t.name}`} disabled={atMax||stale||capYear!==rosterSeason} onClick={()=>{add(t);setTeamSearch('');if(storeTeams.length+1>=2)setTeamPickerOpen(false);}}>
              <TeamLogo abbr={t.abbr} size={34}/><span className="min-w-0"><strong>{t.abbr}</strong><small>{t.name}</small></span><span className="plus" aria-hidden="true">+</span>
            </button>)}
          </div>
          {query&&filteredTeams.length===0&&<p role="status" className="py-4 text-sm text-[var(--muted)]">No available teams match “{teamSearch}”. Try another city or team name.</p>}
          {atMax&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">Seven teams is the limit. Remove a team to choose another.</p>}
          <div className="team-picker-footer">
            {!query&&<button className="ui-button" aria-expanded={showAllTeams} onClick={()=>setShowAllTeams(v=>!v)}>{showAllTeams?'Show popular teams':`Browse all ${withData.length} teams`}</button>}
            <span>Players, salaries and picks load with each team.</span>
          </div>
        </div>}
      </section>
      {capYear!==rosterSeason?<div role="status" className="panel rounded-xl p-6 text-sm text-[var(--muted)]">Loading the matching rosters and rules…</div>:storeTeams.length>0 ? (
        <TradeMatrix contracts={contracts} teamMeta={teamMeta} picks={picks} freeAgents={enrichedFreeAgents} projectedRecords={projectedRecords} />
      ) : <div className="board-empty">Your trade board will appear here. Start with your favorite team above.</div>}
      {confirmation&&<ConfirmDialog title={confirmation==='current'?'Start with current rosters?':'Start a new trade?'} description="This replaces the board in this browser. Save a share link first if you want to return to this proposal." action="Start new trade" onCancel={()=>setConfirmation(null)} onConfirm={()=>{startNewBoard();setConfirmation(null);setTeamPickerOpen(false);}}/>}
      {removeTeam&&<ConfirmDialog title={`Remove ${removeTeam}?`} description="This removes the team and its moves from your current proposal. Other teams stay on the board." action="Remove team" onCancel={()=>setRemoveTeam(null)} onConfirm={()=>{useTradeStore.getState().removeTeam(removeTeam);setRemoveTeam(null);}}/>}
    </div>
  );
}
