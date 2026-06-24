'use client';
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { FreeAgent } from '@/lib/store/tradeStore';
import { selectValidation, selectFixes } from '@/lib/store/selectValidation';
import { TeamColumn } from './TeamColumn';
import { ValidationFeed } from './ValidationFeed';
import { CapSheet } from './CapSheet';
import { TradeGrade } from './TradeGrade';
import { PlayerCompare } from './PlayerCompare';
import { TradeRulesButton } from './TradeRules';
import { ExecuteTradeButton } from './ExecuteTradeButton';
import { GenerateLinkButton } from './GenerateLinkButton';
import type { ContractYear, DbTeam, DbDraftPick } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export function TradeMatrix({
  contracts,
  teamMeta,
  picks,
  freeAgents = [],
}: {
  contracts: Record<string, ContractYear[]>;
  teamMeta: Record<string, DbTeam>;
  picks: Record<string, DbDraftPick[]>;
  freeAgents?: FreeAgent[];
}) {
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const simulatedDate = useTradeStore((s) => s.simulatedDate);
  const tradeMethod = useTradeStore((s) => s.tradeMethod);
  const setSimulatedDate = useTradeStore((s) => s.setSimulatedDate);
  const setTradeMethod = useTradeStore((s) => s.setTradeMethod);
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const reorderAsset = useTradeStore((s) => s.reorderAsset);
  const playerSort = useTradeStore((s) => s.playerSort);
  const setPlayerSort = useTradeStore((s) => s.setPlayerSort);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // distance constraint so a click on a card's buttons isn't read as a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const validation = useMemo(
    () => selectValidation({ season, teams, assets, simulatedDate, tradeMethod }),
    [season, teams, assets, simulatedDate, tradeMethod],
  );
  const fixes = useMemo(
    () => (validation.valid ? [] : selectFixes({ season, teams, assets, simulatedDate, tradeMethod })),
    [validation.valid, season, teams, assets, simulatedDate, tradeMethod],
  );
  const byTeam = useMemo(() => Object.fromEntries(validation.perTeam.map((t) => [t.abbr, t])), [validation]);
  const isTrade = teams.length >= 2;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const dragged = assets[activeId];
    if (!dragged) return;

    // A card lives in its destination column (toTeam). Resolve the column this drop targets:
    // a column droppable, or the destination column of the hovered card.
    const targetTeam = overId.startsWith('col:') ? overId.slice(4) : assets[overId]?.toTeam;
    if (!targetTeam) return;

    if (targetTeam === dragged.toTeam) {
      // same column → reorder within the card's own group (no-op if hovering a different group)
      if (assets[overId] && overId !== activeId) reorderAsset(activeId, overId);
    } else {
      routeAsset(activeId, targetTeam); // move the card into the target team's roster
      // dropped onto a specific card → land at that slot, not just appended to the bottom
      if (assets[overId] && overId !== activeId) reorderAsset(activeId, overId);
    }
  }

  const activeAsset = activeId ? assets[activeId] : null;

  const SORTS = [
    ['salary_desc', 'Salary ↓'],
    ['salary_asc', 'Salary ↑'],
    ['position', 'Position'],
  ] as const;

  return (
    <div className="space-y-4">
      {teams.length >= 1 && (
        <div className="panel flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-3.5 py-2.5 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Sort</span>
            {SORTS.map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setPlayerSort(mode)}
                className={`rounded px-2 py-0.5 font-semibold transition ${
                  playerSort === mode ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {isTrade && (
          <>
          <div className="h-4 w-px bg-[var(--border)]" />
          <label className="flex items-center gap-2 text-[var(--muted)]">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Trade date</span>
            <input
              type="date"
              value={simulatedDate ?? ''}
              onChange={(e) => setSimulatedDate(e.target.value || undefined)}
              className="rounded bg-[var(--surface-2)] px-2 py-1 text-[var(--text)] outline-none"
            />
            {simulatedDate && (
              <button onClick={() => setSimulatedDate(undefined)} className="text-[var(--faint)] hover:text-[var(--text)]">
                clear
              </button>
            )}
          </label>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Method</span>
            {(['simultaneous', 'non_simultaneous'] as const).map((mth) => (
              <button
                key={mth}
                onClick={() => setTradeMethod(mth)}
                className={`rounded px-2 py-0.5 font-semibold transition ${
                  tradeMethod === mth ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {mth === 'simultaneous' ? 'Simultaneous' : 'Non-simultaneous (TPE)'}
              </button>
            ))}
          </div>
          </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[10px] text-[var(--faint)] sm:inline">
              Drag a card into another team to trade it; reorder within a team.
            </span>
            <TradeRulesButton />
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="scroll-x flex gap-3 overflow-x-auto pb-2">
          {teams.map((t) => (
            <div key={t.abbr} className="snap-start">
              <TeamColumn
                abbr={t.abbr}
                meta={teamMeta[t.abbr]}
                result={byTeam[t.abbr]}
                contracts={contracts}
                picks={picks[t.abbr] ?? []}
                freeAgents={freeAgents}
              />
            </div>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeAsset ? (
            <div className="cursor-grabbing rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2.5 py-2 text-[13px] font-medium text-[var(--text)] shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{activeAsset.label}</span>
                {activeAsset.kind === 'cash'
                  ? activeAsset.amount && <span className="num text-xs text-[var(--muted)]">{m(activeAsset.amount)}</span>
                  : activeAsset.salary > 0 && <span className="num text-xs text-[var(--muted)]">{m(activeAsset.salary)}</span>}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TradeGrade />
      <CapSheet />

      {isTrade ? (
        <div className="grid gap-3 md:grid-cols-[1fr_280px] md:items-stretch">
          <ValidationFeed validation={validation} fixes={fixes} />
          <div className="space-y-2">
            <ExecuteTradeButton valid={validation.valid} onExecute={() => { /* Phase 6 interstitial */ }} />
            <GenerateLinkButton />
          </div>
        </div>
      ) : (
        <div className="panel ticked flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-center">
          <span className="eyebrow">Inspecting one team</span>
          <span className="text-[13px] text-[var(--muted)]">— add another team above to build and validate a trade.</span>
        </div>
      )}

      <PlayerCompare />
    </div>
  );
}
