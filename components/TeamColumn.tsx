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
import type { TeamResult } from '@/lib/cba/types';
import type { ContractYear, DbTeam, DbDraftPick } from '@/lib/data/types';
import { parseProtection } from '@/lib/cba/protections';
import { resolveConveyance } from '@/lib/cba/conveyance';

// ESPN logo abbreviations differ from ours for a handful of teams.
const ESPN_ABBR: Record<string, string> = { GSW: 'gs', NOP: 'no', NYK: 'ny', SAS: 'sa', UTA: 'utah', WAS: 'wsh' };
const espnLogo = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${(ESPN_ABBR[abbr] ?? abbr).toLowerCase()}.png`;

function TeamLogo({ abbr, color, color2 }: { abbr: string; color: string; color2: string }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md font-display text-[11px] font-bold text-white shadow-inner"
      style={{ background: `linear-gradient(135deg, ${color}, ${color2})` }}
    >
      {err ? (
        abbr
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={espnLogo(abbr)} alt={abbr} loading="lazy" onError={() => setErr(true)} className="h-7 w-7 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
      )}
    </div>
  );
}

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
  const hereExtras = here.filter((a) => a.kind !== 'player').sort(byOrder);
  const sortableIds = [...herePlayers, ...hereExtras].map((a) => a.id);

  const color = meta?.primary_color ?? '#334155';
  const color2 = meta?.secondary_color ?? color;

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
      label: `${next.season} ${next.round === 1 ? '1st' : '2nd'}`,
      pickYear: Number(next.season),
      round: next.round as 1 | 2,
      isFrozen: next.is_frozen,
      isSwap: next.is_swap,
      originalTeam: next.original_team_id,
      protections: parseProtection(next.protections),
    });
  }
  function addCash() {
    addAsset({ id: crypto.randomUUID(), kind: 'cash', salary: 0, amount: 1_000_000, fromTeam: abbr, toTeam: abbr, label: 'Cash' });
  }

  return (
    <div
      ref={setNodeRef}
      className={`panel flex w-[290px] flex-col overflow-hidden rounded-xl transition ${isOver ? 'drop-active' : ''}`}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color2})` }} />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <TeamLogo abbr={abbr} color={color} color2={color2} />
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

      <TradeSummary abbr={abbr} />

      {/* Draft capital — owned future picks (click a chip to add it to the deal). */}
      <div className="border-t border-[var(--border-soft)] px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]"
            title="Real future-pick ownership (firsts + seconds, drafts 2027-2033) as of June 2026 — own + acquired picks, researched from ESPN / Fanspo / trade reporting. Protection wording is approximate."
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

      <div className="flex-1 px-3 pb-3 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">Roster</span>
          <div className="flex items-center gap-1">
            {freeAgents.length > 0 && (
              <button
                onClick={() => setSigning(true)}
                title="Sign a free agent to this team"
                className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)]"
              >
                + Sign FA
              </button>
            )}
            <button onClick={addCash} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)]">
              + Cash
            </button>
          </div>
        </div>

        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {herePlayers.map((a) => (
              <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />
            ))}
            {herePlayers.length === 0 && <div className="text-xs text-[var(--faint)]">All players traded away</div>}
          </div>

          {hereExtras.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {hereExtras.map((a) => (
                <AssetRow key={a.id} asset={a} teams={teams} />
              ))}
            </div>
          )}
        </SortableContext>

      </div>

      {signing && (
        <SignFreeAgentPanel abbr={abbr} freeAgents={freeAgents} onClose={() => setSigning(false)} />
      )}
    </div>
  );
}
