'use client';
import { useState } from 'react';
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
  projectedRecords = {},
}: {
  abbr: string;
  meta?: DbTeam;
  result?: TeamResult;
  contracts: Record<string, ContractYear[]>;
  picks?: DbDraftPick[];
  freeAgents?: FreeAgent[];
  projectedRecords?: Record<string, import('@/lib/data/queries').ProjectedRecord>;
}) {
  const assetsMap = useTradeStore((s) => s.assets);
  const teams = useTradeStore((s) => s.teams);
  const removeTeam = useTradeStore((s) => s.removeTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const [signing, setSigning] = useState(false);
  const [chOpen, setChOpen] = useState(false);
  const [playerSearch,setPlayerSearch]=useState('');
  const [confirmRemove,setConfirmRemove]=useState(false);

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
  const visiblePlayers=herePlayers.filter(a=>a.label.toLowerCase().includes(playerSearch.trim().toLowerCase()));
  const hereExtras = here.filter((a) => a.kind !== 'player').sort(byOrder);
  const sortableIds = [...hereExtras, ...visiblePlayers].map((a) => a.id);

  const color = meta?.primary_color ?? '#334155';

  const addedPickIds = new Set(assets.filter((a) => a.fromTeam === abbr && a.kind === 'pick').map((a) => a.id));
  const sortedPicks = [...picks].sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
  const availablePicks = sortedPicks.filter((p) => !addedPickIds.has(p.id));
  const firstCount = picks.filter((p) => p.round === 1).length;
  const secondCount = picks.filter((p) => p.round === 2).length;
  function addPick(next: DbDraftPick) {
    addAsset({
      id: next.id,
      kind: 'pick',
      salary: 0,
      fromTeam: abbr,
      toTeam: abbr,
      label: `${next.season} ${next.original_team_id.toUpperCase()} ${next.round === 1 ? '1st' : '2nd'}`,
      pickYear: Number(next.season),
      round: next.round as 1 | 2,
      isFrozen: next.is_frozen,
      isSwap: next.is_swap,
      originalTeam: next.original_team_id.toUpperCase(),
      protections: parseProtection(next.protections),
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
      {/* Reported draft rights retain their protection and swap notes. */}
      <div className="border-t border-[var(--border-soft)] px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]"
            title="Reported future draft rights. Asterisks identify source notes; conditional rights require review of the complete protection and swap chain."
          >
            Draft capital
          </span>
          <span className="num text-[10px] text-[var(--muted)]">
            {firstCount} <span className="text-[var(--faint)]">1st</span> · {secondCount}{' '}
            <span className="text-[var(--faint)]">2nd</span>
          </span>
        </div>
        {availablePicks.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {availablePicks.map((p) => {
              const note =
                p.protections && typeof p.protections === 'object' && 'note' in p.protections
                  ? String((p.protections as { note?: unknown }).note ?? '')
                  : '';
              // Resolve conveyance against the ORIGINAL team's projected draft slot (its pick, its record).
              const rec = projectedRecords[p.original_team_id];
              const structured = parseProtection(p.protections);
              const conveyance =
                rec && p.round === 1 && structured && (structured.type === 'top' || structured.type === 'range')
                  ? resolveConveyance(structured, rec.projectedSlot)
                  : null;
              const title = [
                `Add ${p.season} ${p.round === 1 ? '1st' : '2nd'} to the deal`,
                p.is_swap ? 'Swap rights' : '',
                p.is_frozen ? 'Frozen (2nd-apron 7-yr-out)' : '',
                note ? `Protected: ${note}` : '',
                rec ? `Projected #${rec.projectedSlot} (${rec.wins}-${rec.losses})` : '',
                conveyance ? conveyance.reason : '',
              ].filter(Boolean).join(' — ');
              return (
                <button
                  key={p.id}
                  onClick={() => addPick(p)}
                  title={title}
                  className="num inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-2)]/50 px-1.5 py-0.5 text-[10px] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                >
                  {p.season.slice(2)} {p.round === 1 ? '1st' : '2nd'}
                  <span>{p.original_team_id.toUpperCase()}</span>
                  {p.is_swap && <span className="text-[var(--accent-2)]" title="Swap">⇄</span>}
                  {p.is_frozen && <span className="text-[var(--illegal)]" title="Frozen (2nd-apron)">❄</span>}
                  {note && <span className="text-[var(--faint)]" title={`Protected: ${note}`}>*</span>}
                  {conveyance && (
                    <span
                      title={conveyance.reason}
                      style={{ color: conveyance.conveys ? 'var(--legal)' : 'var(--warn)' }}
                    >
                      {conveyance.conveys ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--faint)]">
            {picks.length ? 'All picks added to the deal' : 'No tradeable future picks'}
          </div>
        )}
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
          <button onClick={() => setChOpen((o) => !o)} className="flex w-full items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]"
              title="Free-agent cap holds count against this team's cap until renounced. Amounts are approximate (~120% of prior salary)."
            >
              Cap holds {capHolds.length}
            </span>
            <span className="num text-[10px] text-[var(--muted)]">~{mny(capHoldTotal)} {chOpen ? '▾' : '▸'}</span>
          </button>
          {chOpen && (
            <div className="mt-1.5 space-y-0.5">
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

        <label className="roster-search block"><span className="sr-only">Search {abbr} players</span><input className="ui-input" type="search" name={`players-${abbr}`} autoComplete="off" placeholder="Find a player…" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}/></label>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {hereExtras.length > 0 && (
            <div className="mb-3 space-y-2">
              {hereExtras.map((a) => (
                <AssetRow key={a.id} asset={a} teams={teams} />
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {visiblePlayers.map((a) => (
              <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />
            ))}
            {visiblePlayers.length===0&&<p role="status" className="p-3 text-sm text-[var(--muted)]">{herePlayers.length?'No players match. Try another name.':'All players have been moved to another team.'}</p>}
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
