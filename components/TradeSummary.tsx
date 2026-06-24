'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset } from '@/lib/cba/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const salOf = (a: TradeAsset) => (a.kind === 'cash' ? a.amount ?? 0 : a.salary);

function Avatar({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  if (!src || err) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg)] text-[8px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]">
        {initials}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setErr(true)} className="h-5 w-5 shrink-0 rounded-full bg-[var(--bg)] object-cover object-top ring-1 ring-[var(--border)]" />;
}

function Chip({ asset, onRemove }: { asset: TradeAsset; onRemove: () => void }) {
  const icon = asset.kind === 'pick' ? '🎟' : asset.kind === 'cash' ? '💵' : null;
  return (
    <span className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-0.5 pl-1 pr-1.5 text-[11px] text-[var(--text)]">
      {asset.kind === 'player' ? <Avatar src={asset.headshot} name={asset.label} /> : <span className="px-0.5 text-[10px]">{icon}</span>}
      <span className="max-w-[130px] truncate">{asset.label}</span>
      <button onClick={onRemove} aria-label={`Remove ${asset.label}`} className="text-[var(--faint)] transition hover:text-[var(--illegal)]">
        ✕
      </button>
    </span>
  );
}

function Side({
  label,
  sign,
  total,
  color,
  assets,
  onRemove,
}: {
  label: string;
  sign: '-' | '+';
  total: number;
  color: string;
  assets: TradeAsset[];
  onRemove: (a: TradeAsset) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          {label} <span className="num font-semibold" style={{ color }}>({sign} {m(total)})</span>
        </span>
        <span className="text-[var(--faint)]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 pb-0.5">
          {assets.length === 0 ? (
            <span className="text-[10px] text-[var(--faint)]">—</span>
          ) : (
            assets.map((a) => <Chip key={a.id} asset={a} onRemove={() => onRemove(a)} />)
          )}
        </div>
      )}
    </div>
  );
}

/** Fanspo-style per-team recap: salary leaving vs arriving, with the net change. */
export function TradeSummary({ abbr }: { abbr: string }) {
  const assetsMap = useTradeStore((s) => s.assets);
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const byOrder = (a: TradeAsset, b: TradeAsset) => (a.order ?? 0) - (b.order ?? 0);
  const assets = Object.values(assetsMap);
  const outgoing = assets.filter((a) => a.fromTeam === abbr && a.toTeam !== abbr).sort(byOrder);
  const incoming = assets.filter((a) => a.toTeam === abbr && a.fromTeam !== abbr).sort(byOrder);
  if (outgoing.length === 0 && incoming.length === 0) return null;

  const outTotal = outgoing.reduce((s, a) => s + salOf(a), 0);
  const inTotal = incoming.reduce((s, a) => s + salOf(a), 0);
  const net = inTotal - outTotal;

  return (
    <div className="border-t border-[var(--border-soft)] px-3 py-2">
      <Side label="Outgoing" sign="-" total={outTotal} color="var(--illegal)" assets={outgoing} onRemove={(a) => routeAsset(a.id, abbr)} />
      <Side label="Incoming" sign="+" total={inTotal} color="var(--legal)" assets={incoming} onRemove={(a) => routeAsset(a.id, a.fromTeam)} />
      <div className="mt-1 flex items-center justify-between border-t border-[var(--border-soft)] pt-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Net salary</span>
        <span className="num text-[11px] font-semibold" style={{ color: net > 0 ? 'var(--illegal)' : net < 0 ? 'var(--legal)' : 'var(--muted)' }}>
          {net > 0 ? '+' : net < 0 ? '-' : ''}{m(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}
