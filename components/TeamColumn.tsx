'use client';
import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { FreeAgent } from '@/lib/store/tradeStore';
import { PlayerCard } from './PlayerCard';
import { AssetRow } from './AssetRow';
import { TeamCapPanel } from './TeamCapPanel';
import { SignFreeAgentPanel } from './SignFreeAgentPanel';
import { TradeSummary } from './TradeSummary';
import { CashBudget } from './CashBudget';
import { PickDetails } from './PickDetails';
import { matchesPlayerName } from '@/lib/search';
import type { TeamResult } from '@/lib/cba/types';
import type { ContractYear, DbTeam, DbDraftPick } from '@/lib/data/types';
import { parseProtection } from '@/lib/cba/protections';
import { resolveConveyance } from '@/lib/cba/conveyance';

import { TeamLogo } from './TeamLogo';
import {ConfirmDialog} from './ConfirmDialog';

export function TeamColumn({
  abbr,
  meta,
  result,
  contracts,
  picks = [],
  freeAgents = [],
  pickLookup = {},
  projectedRecords = {},
}: {
  abbr: string;
  meta?: DbTeam;
  result?: TeamResult;
  contracts: Record<string, ContractYear[]>;
  picks?: DbDraftPick[];
  freeAgents?: FreeAgent[];
  projectedRecords?: Record<string, import('@/lib/data/queries').ProjectedRecord>;
  pickLookup?: Record<string, DbDraftPick>;
}) {
  const assetsMap = useTradeStore((s) => s.assets);
  const teams = useTradeStore((s) => s.teams);
  const removeTeam = useTradeStore((s) => s.removeTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const [signing, setSigning] = useState(false);
  const [chOpen, setChOpen] = useState(false);
  const [playerSearch,setPlayerSearch]=useState('');
  const [confirmRemove,setConfirmRemove]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);

  // The whole column is a droppable so a card dropped anywhere on it routes here.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${abbr}` });

  const teamExceptions = teams.find((t) => t.abbr === abbr)?.exceptions ?? [];

  // Free-agent cap holds this team carries (its own FAs), ~120% of prior salary until renounced.
  const capHolds = freeAgents
    .filter((fa) => (fa.priorTeamId ?? '').toLowerCase() === abbr.toLowerCase())
    .map((fa) => ({ name: fa.name, hold: Math.round((fa.priorSalary || 0) * 1.2), restricted: fa.restricted }))
    .sort((a, b) => b.hold - a.hold);
  const capHoldTotal = capHolds.reduce((s, c) => s + c.hold, 0);
  const mny = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

  // A card lives in its destination column (toTeam): kept players + players acquired from others, in
  // one reorderable list ordered by `order` (which is maintained per display column). Players this team
  // is sending out render as non-draggable "trading away" ghosts (their draggable home is the
  // destination column), which keeps every dnd-kit id unique to one SortableContext.
  const assets = Object.values(assetsMap);
  const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
  const here = assets.filter((a) => a.toTeam === abbr);
  const herePlayers = here.filter((a) => a.kind === 'player').sort(byOrder);
  const visiblePlayers=herePlayers.filter(a=>matchesPlayerName(a.label, playerSearch));
  const hereExtras = here.filter((a) => a.kind !== 'player').sort(byOrder);
  const sortableIds = [...hereExtras, ...visiblePlayers].map((a) => a.id);

  const color = meta?.primary_color ?? '#334155';

  const sortedPicks = [...picks].sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
  const firstCount = picks.filter((p) => p.round === 1).length;
  const secondCount = picks.filter((p) => p.round === 2).length;
  function addPick(next: DbDraftPick, destination: string) {
    if (assetsMap[next.id]) {
      routeAsset(next.id, destination);
      return;
    }
    addAsset({
      id: next.id,
      kind: 'pick',
      salary: 0,
      fromTeam: abbr,
      toTeam: destination,
      label: `${next.season} ${next.original_team_id.toUpperCase()} ${next.round === 1 ? '1st' : '2nd'}`,
      pickYear: Number(next.season),
      round: next.round as 1 | 2,
      isFrozen: next.is_frozen,
      isSwap: next.is_swap,
      originalTeam: next.original_team_id.toUpperCase(),
      protections: parseProtection(next.protections),
      source: next.source,
      dataNotes:next.needsReview?['Conditional draft rights: verify the full protection, swap and rollover chain at '+(next.source??'the source')+'.']:undefined,
    });
  }
  function addCash() {
    const draft = assets.find(a => a.kind === 'cash' && a.fromTeam === abbr && a.toTeam === abbr);
    if (draft) {
      document.getElementById(`cash-amount-${draft.id}`)?.focus();
      return;
    }
    addAsset({ id: crypto.randomUUID(), kind: 'cash', salary: 0, amount: 1_000_000, fromTeam: abbr, toTeam: abbr, label: 'Cash' });
  }

  return (
    <div
      ref={setNodeRef}
      className={`panel team-column flex flex-col ${isOver ? 'drop-active' : ''}`}
    >
      <div className="h-1" style={{backgroundColor:color}}/>
      <div className="team-column-header">
        <TeamLogo abbr={abbr} size={42}/>
        <div className="min-w-0"><h3 id={`roster-${abbr}`} tabIndex={-1}>{abbr}</h3><p>{meta?.name??abbr}</p></div>
        <button onClick={()=>setConfirmRemove(true)} aria-label={`Remove ${abbr}`}>×</button>
      </div>
      <div className="border-t border-[var(--border-soft)] px-3 py-3">
        <TeamCapPanel result={result} />
      </div>

      <TradeSummary abbr={abbr} />
      <CashBudget abbr={abbr}/>

      <details className="team-extras"><summary>Picks &amp; exceptions <span className="text-xs font-normal text-[var(--muted)]">{firstCount} firsts / {secondCount} seconds</span></summary>
      <div className="border-t border-[var(--border-soft)] px-3 py-3">
        <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">Reported draft rights. Open a pick to read its conditions and choose a destination.</p>
        {sortedPicks.length > 0 ? <div className="space-y-2">
          {sortedPicks.map(p => {
            const current=assetsMap[p.id];
            const included=!!current && current.toTeam!==current.fromTeam;
            const label=`${p.season} ${p.original_team_id.toUpperCase()} ${p.round===1?'1st':'2nd'}`;
            const record=projectedRecords[p.original_team_id];
            const protection=parseProtection(p.protections);
            const conveyance=record&&p.round===1&&protection&&(protection.type==='top'||protection.type==='range')?resolveConveyance(protection,record.projectedSlot):null;
            return <details key={p.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)]">
              <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold">
                <span className="min-w-0">{label}{p.is_swap?' · Swap':''}{p.is_frozen?' · Frozen':''}
                <span className="mt-1 block text-[11px] font-normal text-[var(--muted)]">{included?`Included: ${abbr} → ${current.toTeam}`:current?'Not included · choose a destination':p.needsReview?'Conditional rights · review terms':'Details & destination'}</span></span>
              </summary>
              <div className="space-y-3 border-t border-[var(--border-soft)] p-3">
                <PickDetails pick={p} asset={current}/>
                {record&&<details className="border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-2">Illustrative conveyance estimate</summary><p>Using {p.original_team_id.toUpperCase()} at pick #{record.projectedSlot} from the supplied {record.wins}–{record.losses} record baseline. This is not a lottery result or a forecast of ownership.</p>{conveyance&&<p className="mt-2">{conveyance.reason} Other source conditions still need verification.</p>}</details>}
                <div className="border-t border-[var(--border-soft)] pt-3">
                  <p className="mb-2 text-xs font-semibold">{included?'Change destination':'Include this pick by sending it to'}</p>
                  <div className="flex flex-wrap gap-2">{teams.filter(t=>t.abbr!==abbr).map(t=><button key={t.abbr} className="route-button min-h-11" aria-label={`Send ${label} to ${t.abbr}`} aria-pressed={current?.toTeam===t.abbr} onClick={()=>addPick(p,t.abbr)}>Send to {t.abbr}</button>)}
                  {included&&<button className="route-button min-h-11" onClick={()=>addPick(p,abbr)}>Return to {abbr}</button>}</div>
                  {teams.length<2&&<p className="text-xs text-[var(--muted)]">Add another team to choose a destination.</p>}
                </div>
              </div>
            </details>;
          })}
        </div> : <p className="text-xs text-[var(--muted)]">No future draft rights supplied for this team.</p>}
      </div>

      {teamExceptions.length > 0 && (
        <div className="border-t border-[var(--border-soft)] px-3 py-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]" title="Traded-player exceptions can absorb one incoming player (non-simultaneous method) without matching salary.">
            Trade exceptions
          </div>
          <div className="flex flex-wrap gap-1">
            {teamExceptions.map((e, i) => (
              <span key={i} className="num inline-flex items-center gap-1 rounded border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 px-1.5 py-0.5 text-[10px] text-[var(--text)]">
                {e.kind === 'tpe' ? 'TPE' : e.kind.toUpperCase()} ${(e.amount / 1_000_000).toFixed(1)}M
                {typeof e.expires === 'string' && <span className="text-[var(--faint)]">· exp {e.expires.slice(0, 7)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {capHolds.length > 0 && (
        <div className="border-t border-[var(--border-soft)] px-3 py-2.5">
          <button onClick={() => setChOpen((o) => !o)} aria-expanded={chOpen} aria-controls={`cap-holds-${abbr}`} className="flex min-h-11 w-full items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]"
              title="Free-agent cap holds count against this team's cap until renounced. Amounts are approximate (~120% of prior salary)."
            >
              Cap holds {capHolds.length}
            </span>
            <span className="num text-[10px] text-[var(--muted)]">~{mny(capHoldTotal)} {chOpen ? '▾' : '▸'}</span>
          </button>
          {chOpen && (
            <div id={`cap-holds-${abbr}`} className="mt-1.5 space-y-0.5">
              <p className="mb-2 text-xs text-[var(--muted)]">Estimates at 120% of prior salary. These are not verified cap-hold amounts.</p>
              {capHolds.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1 truncate text-[var(--muted)]">
                    {c.name}
                    {c.restricted && <span className="rounded bg-[var(--accent-2)]/20 px-1 text-[8px] font-bold uppercase text-[var(--accent-2)]">RFA</span>}
                  </span>
                  <span className="num shrink-0 text-[var(--faint)]">~{mny(c.hold)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </details>
      <div className="flex-1 px-3 pb-3 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold">Roster <span className="text-xs font-normal text-[var(--muted)]">{herePlayers.length} players</span></span>
          <div className="flex items-center gap-1">
            {freeAgents.length > 0 && (
              <button
                onClick={() => setSigning(true)}
                title="Sign a free agent to this team"
                className="route-button"
              >
                Sign free agent
              </button>
            )}
            <button onClick={addCash} className="route-button">
              + Cash
            </button>
          </div>
        </div>

        <div className="roster-search">
          <label className="block"><span className="mb-1 block text-xs font-medium text-[var(--muted)]">Search {abbr} roster</span><input ref={searchRef} className="ui-input" type="search" name={`players-${abbr}`} autoComplete="off" spellCheck={false} placeholder={`Find a ${abbr} player…`} value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} aria-describedby={`roster-search-status-${abbr}`}/></label>
          <div className="mt-1 flex min-h-8 items-center justify-between gap-2 text-xs text-[var(--muted)]"><p id={`roster-search-status-${abbr}`} role="status">{playerSearch.trim()?`${visiblePlayers.length} of ${herePlayers.length} players match`:'Searches this roster, including incoming players.'}</p>{playerSearch&&<button className="route-button min-h-11" aria-label={`Clear ${abbr} roster search`} onClick={()=>{setPlayerSearch('');searchRef.current?.focus();}}>Clear</button>}</div>
        </div>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {hereExtras.length > 0 && (
            <div className="mb-3 space-y-2">
              {hereExtras.map((a) => (
                <AssetRow key={a.id} asset={a} teams={teams} pick={pickLookup[a.id]??picks.find(p=>p.id===a.id)} />
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {visiblePlayers.map((a) => (
              <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />
            ))}
            {visiblePlayers.length===0&&<p role="status" className="p-3 text-sm text-[var(--muted)]">{herePlayers.length?`No ${abbr} roster players match “${playerSearch}”. Try a last name or clear the search.`:'All players have been moved to another team.'}</p>}
          </div>

        </SortableContext>

      </div>

      {confirmRemove&&<ConfirmDialog title={`Remove ${abbr}?`} description="This removes the team and its moves from your current proposal. Other teams stay on the board." action="Remove team" onCancel={()=>setConfirmRemove(false)} onConfirm={()=>removeTeam(abbr)}/>}
      {signing && (
        <SignFreeAgentPanel abbr={abbr} freeAgents={freeAgents} onClose={() => setSigning(false)} />
      )}
    </div>
  );
}
