'use client';
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTradeStore } from '@/lib/store/tradeStore';
import { PlayerContractModal } from './PlayerContractModal';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

function Headshot({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  if (!src || err) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]">
        {initials}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setErr(true)}
      className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-2)] object-cover object-top ring-1 ring-[var(--border)]"
    />
  );
}
const OPT: Record<string, string> = { team: 'TO', player: 'PO', eto: 'ETO', guaranteed: '', non_guaranteed: 'NG', two_way: '2W' };

// Buttons inside a draggable card must not start a drag — swallow the pointerdown
// before dnd-kit's sensor sees it so clicks (route, open modal, compare) still fire.
const noDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

export function PlayerCard({
  asset,
  contract,
  teams,
}: {
  asset: TradeAsset;
  contract?: ContractYear[];
  teams: TradeTeamInput[];
}) {
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const toggleCompare = useTradeStore((s) => s.toggleCompare);
  const compareIds = useTradeStore((s) => s.compareIds);
  const dests = teams.filter((t) => t.abbr !== asset.fromTeam);
  const routed = asset.toTeam !== asset.fromTeam;
  const inCompare = compareIds.includes(asset.id);
  const [showModal, setShowModal] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group/card touch-none cursor-grab rounded-lg border px-2.5 py-2 transition active:cursor-grabbing ${
          routed ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8' : 'border-[var(--border-soft)] bg-[var(--surface-2)]/40'
        } ${inCompare ? 'ring-1 ring-[var(--accent-2)]' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          <Headshot src={asset.headshot} name={asset.label} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  {...noDrag}
                  onClick={() => setShowModal(true)}
                  className="truncate text-left text-[13px] font-medium text-[var(--text)] transition hover:text-[var(--accent)]"
                  title="View / edit contract"
                >
                  {asset.label}
                  {asset.jersey && <span className="num ml-1 text-[10px] text-[var(--faint)]">#{asset.jersey}</span>}
                </button>
                {asset.fromTeam !== asset.toTeam && (
                  <span className="shrink-0 rounded bg-[var(--accent)]/20 px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]" title={`Acquired from ${asset.fromTeam}`}>
                    from {asset.fromTeam}
                  </span>
                )}
              </div>
              <span className="num shrink-0 text-[13px] font-semibold text-[var(--text)]">{m(asset.salary)}</span>
            </div>

            {(asset.position || asset.height || asset.age != null) && (
              <div className="mt-0.5 text-[10px] text-[var(--faint)]">
                {[asset.position, asset.height, asset.weight ? `${asset.weight} lbs` : null, asset.age != null ? `${asset.age} yo` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}

            {asset.pts != null && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--faint)]">
                {asset.value != null && <span className="font-semibold text-[var(--muted)]">{asset.value} GS</span>}
                <span>{asset.pts} pts</span>
                <span>{asset.reb} reb</span>
                <span>{asset.ast} ast</span>
              </div>
            )}
          </div>
        </div>

        {contract && contract.length > 1 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {contract.map((c) => (
              <span key={c.season} className="num rounded bg-[var(--bg)]/60 px-1 text-[10px] text-[var(--muted)]">
                {c.season.slice(2)} {m(c.salary)}
                {OPT[c.option_type] ? ` ${OPT[c.option_type]}` : ''}
                {c.no_trade_clause ? ' NTC' : ''}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            {...noDrag}
            onClick={() => routeAsset(asset.id, asset.fromTeam)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
              !routed ? 'bg-[var(--surface-2)] text-[var(--muted)]' : 'text-[var(--faint)] hover:bg-[var(--surface-2)]'
            }`}
          >
            Stay
          </button>
          {dests.map((t) => {
            const active = asset.toTeam === t.abbr;
            return (
              <button
                key={t.abbr}
                {...noDrag}
                onClick={() => routeAsset(asset.id, t.abbr)}
                className={`rounded px-1.5 py-0.5 font-display text-[11px] font-semibold tracking-wide transition ${
                  active ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                → {t.abbr}
              </button>
            );
          })}
          <button
            {...noDrag}
            onClick={() => toggleCompare(asset.id)}
            title={inCompare ? 'Remove from comparison' : 'Add to comparison'}
            className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
              inCompare ? 'bg-[var(--accent-2)] text-[var(--ink)]' : 'text-[var(--faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            }`}
          >
            ⊕ vs
          </button>
        </div>
      </div>
      {showModal && <PlayerContractModal asset={asset} contract={contract} onClose={() => setShowModal(false)} />}
    </>
  );
}
