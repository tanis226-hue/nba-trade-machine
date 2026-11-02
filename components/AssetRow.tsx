'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;



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

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const protectionNote =
    asset.protections && typeof asset.protections === 'object' && 'note' in asset.protections
      ? String((asset.protections as { note?: unknown }).note ?? '')
      : '';

  function move(next:string,event:React.MouseEvent<HTMLButtonElement>) {
    const focusTarget=event.detail===0&&next!==asset.toTeam
      ? event.currentTarget.closest('.player-card')?.nextElementSibling?.querySelector('button')??document.getElementById(`roster-${asset.toTeam}`)
      : null;
    routeAsset(asset.id,next);
    focusTarget?.focus();
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-card ${
        routed ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8' : 'border-[var(--border-soft)] bg-[var(--surface-2)]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag ${asset.label}`} className="drag-handle">⠿</button>
        <span className="flex min-w-0 items-center gap-1 truncate text-[12px] font-medium text-[var(--text)]">
          {asset.kind === 'pick' ? '🎟 ' : '💵 '}
          {asset.label}
          {asset.isSwap && <span className="text-[var(--accent-2)]" title="Swap rights">⇄</span>}
          {asset.isFrozen && <span className="text-[var(--illegal)]" title="Frozen (2nd-apron 7-yr-out)">❄</span>}
        </span>
        {isCash ? (
          <div className="flex items-center gap-1">
            <button
                  onClick={() => setAssetAmount(asset.id, Math.max(0, amount - 500_000))}
              className="route-button" aria-label="Decrease cash by $500,000"
            >
              −
            </button>
            <span className="num w-12 text-center text-[12px] font-semibold text-[var(--text)]">{m(amount)}</span>
            <button
                  onClick={() => setAssetAmount(asset.id, amount + 500_000)}
              className="route-button" aria-label="Increase cash by $500,000"
            >
              +
            </button>
          </div>
        ) : null}
        <button
          onClick={() => removeAsset(asset.id)}
          className="rounded p-0.5 text-[var(--faint)] transition hover:text-[var(--illegal)]"
          aria-label={`Remove ${asset.label}`}
        >
          ✕
        </button>
      </div>

      {protectionNote && (
        <div className="mt-1 text-[10px] leading-snug text-[var(--faint)]">
          <span className="text-[var(--muted)]">Protected:</span> {protectionNote}
        </div>
      )}

      <div className="player-routing">
        <button className="route-button" aria-label={routed?`Return to ${asset.fromTeam}: ${asset.label}`:`Keep: ${asset.label} at ${asset.fromTeam}`} aria-pressed={!routed} onClick={e=>move(asset.fromTeam,e)}>{routed?`Return to ${asset.fromTeam}`:'Keep'}</button>
        {dests.map(t=><button key={t.abbr} className="route-button" aria-label={`Send to ${t.abbr}: ${asset.label}`} aria-pressed={asset.toTeam===t.abbr} onClick={e=>move(t.abbr,e)}>Send to {t.abbr}</button>)}
      </div>
    </div>
  );
}
