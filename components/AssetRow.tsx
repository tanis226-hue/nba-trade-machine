'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const noDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

/** A routable non-player asset (draft pick or cash) with route + remove controls. */
export function AssetRow({
  asset,
  teams,
}: {
  asset: TradeAsset;
  teams: TradeTeamInput[];
}) {
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const removeAsset = useTradeStore((s) => s.removeAsset);
  const setAssetAmount = useTradeStore((s) => s.setAssetAmount);
  const dests = teams.filter((t) => t.abbr !== asset.fromTeam);
  const routed = asset.toTeam !== asset.fromTeam;
  const isCash = asset.kind === 'cash';
  const amount = asset.amount ?? 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const protectionNote =
    asset.protections && typeof asset.protections === 'object' && 'note' in asset.protections
      ? String((asset.protections as { note?: unknown }).note ?? '')
      : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none cursor-grab rounded-lg border px-2.5 py-2 transition active:cursor-grabbing ${
        routed ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8' : 'border-[var(--border-soft)] bg-[var(--surface-2)]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-[12px] font-medium text-[var(--text)]">
          {asset.kind === 'pick' ? '🎟 ' : '💵 '}
          {asset.label}
          {asset.isSwap && <span className="text-[var(--accent-2)]" title="Swap rights">⇄</span>}
          {asset.isFrozen && <span className="text-[var(--illegal)]" title="Frozen (2nd-apron 7-yr-out)">❄</span>}
        </span>
        {isCash ? (
          <div className="flex items-center gap-1">
            <button
              {...noDrag}
              onClick={() => setAssetAmount(asset.id, Math.max(0, amount - 500_000))}
              className="h-4 w-4 rounded bg-[var(--surface-2)] text-[11px] leading-none text-[var(--muted)]"
            >
              −
            </button>
            <span className="num w-12 text-center text-[12px] font-semibold text-[var(--text)]">{m(amount)}</span>
            <button
              {...noDrag}
              onClick={() => setAssetAmount(asset.id, amount + 500_000)}
              className="h-4 w-4 rounded bg-[var(--surface-2)] text-[11px] leading-none text-[var(--muted)]"
            >
              +
            </button>
          </div>
        ) : null}
        <button
          {...noDrag}
          onClick={() => removeAsset(asset.id)}
          className="rounded p-0.5 text-[var(--faint)] transition hover:text-[var(--illegal)]"
          aria-label="Remove asset"
        >
          ✕
        </button>
      </div>

      {protectionNote && (
        <div className="mt-1 text-[10px] leading-snug text-[var(--faint)]">
          <span className="text-[var(--muted)]">Protected:</span> {protectionNote}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
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
      </div>
    </div>
  );
}
