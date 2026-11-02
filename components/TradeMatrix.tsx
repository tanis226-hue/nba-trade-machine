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
import { selectValidation, selectFixes, selectAutoFix } from '@/lib/store/selectValidation';
import { TeamColumn } from './TeamColumn';
import { ValidationFeed } from './ValidationFeed';
import { CapSheet } from './CapSheet';
import { TradeGrade } from './TradeGrade';
import { PlayerCompare } from './PlayerCompare';
import { TradeRulesButton } from './TradeRules';
import { ExecuteTradeButton } from './ExecuteTradeButton';
import { GenerateLinkButton } from './GenerateLinkButton';
import { SaveTradeButton } from './SaveTradeButton';
import { authEnabled } from '@/lib/auth';
import { defaultTradeDate } from '@/lib/data/freshness';
import type { ContractYear, DbTeam, DbDraftPick } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export function TradeMatrix({
  contracts,
  teamMeta,
  picks,
  freeAgents = [],
  projectedRecords = {},
}: {
  contracts: Record<string, ContractYear[]>;
  teamMeta: Record<string, DbTeam>;
  picks: Record<string, DbDraftPick[]>;
  freeAgents?: FreeAgent[];
  projectedRecords?: Record<string, import('@/lib/data/queries').ProjectedRecord>;
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
  const [viewedTeam,setViewedTeam]=useState<string|null>(null);
  const currentTeam=teams.some(t=>t.abbr===viewedTeam)?viewedTeam:teams[0]?.abbr;

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
  const autoFix = useMemo(
    () => (validation.valid ? [] : selectAutoFix({ season, teams, assets, simulatedDate, tradeMethod })),
    [validation.valid, season, teams, assets, simulatedDate, tradeMethod],
  );
  const applyAutoFix = () => autoFix.forEach((a) => routeAsset(a.assetId, a.toTeam));
  const byTeam = useMemo(() => Object.fromEntries(validation.perTeam.map((t) => [t.abbr, t])), [validation]);
  const isTrade = teams.length >= 2;
  const hasMoves = Object.values(assets).some((asset) => asset.fromTeam !== asset.toTeam);
  const movedCount=Object.values(assets).filter(asset=>asset.fromTeam!==asset.toTeam).length;

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
    <div className={hasMoves?'has-trade-moves':''}>
      <p className="sr-only" role="status">{movedCount} {movedCount===1?'asset':'assets'} moved. {hasMoves?(validation.valid?'No blocking trade issues.':'Trade needs changes.'):''}</p>
      {hasMoves&&<a href="#trade-verdict" className="mobile-trade-action"><span>{movedCount} {movedCount===1?'asset':'assets'} moved <small>{validation.valid?'Ready to review':'Trade needs changes'}</small></span><strong>View trade check ↑</strong></a>}
      <div className="workspace-grid">
        <aside id="trade-verdict" className="panel trade-check" aria-labelledby="trade-check-heading">
          <h2 id="trade-check-heading">Trade check</h2>
          {isTrade&&hasMoves?<>
            <ValidationFeed validation={validation} fixes={fixes} onAutoFix={autoFix.length?applyAutoFix:undefined} autoFixCount={autoFix.length}/>
            <div className="trade-check-actions"><ExecuteTradeButton valid={validation.valid}/>{!validation.valid&&<GenerateLinkButton/>}{authEnabled&&<SaveTradeButton/>}</div>
          </>:<div className="trade-check-empty"><strong>{isTrade?'Ready when you are.':'One more team, then game on.'}</strong>{isTrade?'Use “Send to” on a player card or add a draft pick. The salary and roster checks update with every move.':'Add another team above to build a trade. You can explore this roster in the meantime.'}</div>}
          <details className="trade-settings"><summary>Trade settings</summary>
            <label>Trade date<input aria-label="Trade date" type="date" value={simulatedDate??defaultTradeDate(season)} onChange={e=>setSimulatedDate(e.target.value||undefined)}/></label>
            <label>Salary-matching method<select value={tradeMethod} onChange={e=>setTradeMethod(e.target.value as typeof tradeMethod)}><option value="simultaneous">Standard trade (simultaneous)</option><option value="non_simultaneous">Use trade exception (non-simultaneous)</option></select></label>
            <p className="mt-2 text-xs text-[var(--muted)]">Leave the standard method selected unless you are modeling a trade exception.</p>
          </details>
          <TradeRulesButton/>
        </aside>
        <section className="workspace-rosters" aria-label="Team rosters">
          <div className="workspace-controls"><h2>Build your deal</h2><label>Sort players<select aria-label="Sort players" value={playerSort} onChange={e=>setPlayerSort(e.target.value as typeof playerSort)}>{SORTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
          <div className="roster-team-switch" aria-label="Choose a roster">{teams.map(t=><button key={t.abbr} aria-label={`View ${t.abbr} roster`} aria-pressed={currentTeam===t.abbr} onClick={()=>setViewedTeam(t.abbr)}>{t.abbr}</button>)}</div>
          <p className="mb-3 text-xs text-[var(--muted)]">Tap “Send to” to move a player. On desktop, you can also drag using the grip.</p>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="scroll-x roster-columns">
          {teams.map((t) => (
            <div key={t.abbr} className={`roster-column-wrap ${currentTeam!==t.abbr?'mobile-inactive':''}`}>
              <TeamColumn
                abbr={t.abbr}
                meta={teamMeta[t.abbr]}
                result={byTeam[t.abbr]}
                contracts={contracts}
                picks={picks[t.abbr] ?? []}
                freeAgents={freeAgents}
                projectedRecords={projectedRecords}
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

        </section>
      </div>
      <details className="panel optional-analysis"><summary>Trade value &amp; future salaries</summary><div><TradeGrade/><CapSheet/></div></details>
      <PlayerCompare />
    </div>
  );
}
