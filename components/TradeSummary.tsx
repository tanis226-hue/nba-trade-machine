'use client';
import { useId, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { PlayerHeadshot } from './PlayerHeadshot';
import { formatCash as cash } from '@/lib/cba/cash';
import { exactMoney, signedExactMoney } from '@/lib/trades/presentation';
import type { TradeAsset } from '@/lib/cba/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;


function Chip({ asset, onRemove }: { asset: TradeAsset; onRemove: () => void }) {
  const icon = asset.kind === 'pick' ? '🎟' : asset.kind === 'cash' ? '💵' : null;
  const label = asset.kind === 'cash' ? `${asset.label} ${cash(asset.amount ?? 0)}` : asset.label;
  return (
    <span className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-0.5 pl-1 pr-1.5 text-xs text-[var(--text)]">
      {asset.kind === 'player' ? <PlayerHeadshot src={asset.headshot} name={asset.label} size={24}/> : <span className="px-0.5 text-[10px]">{icon}</span>}
      <span className="min-w-0 break-words">{label}</span>
      <button onClick={onRemove} aria-label={`Undo move for ${label}`} className="ml-1 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--illegal)]">
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
  const contentId = useId();
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={contentId} className="flex min-h-11 w-full items-center justify-between py-1">
        <span className="text-xs font-semibold text-[var(--faint)]">
          {label} <span className="num font-semibold" style={{ color }}>({sign} {m(total)} salary)</span>
        </span>
        <span className="text-[var(--faint)]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div id={contentId} className="flex flex-wrap gap-1 pb-0.5">
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

  const outTotal = outgoing.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0);
  const inTotal = incoming.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0);
  const net = inTotal - outTotal;
  const cashSent = outgoing.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
  const cashReceived = incoming.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
  const netCash = cashReceived - cashSent;
  const hasCash = [...outgoing, ...incoming].some((a) => a.kind === 'cash');

  return (
    <div className="border-t border-[var(--border-soft)] px-3 py-2">
      <Side label="Outgoing" sign="-" total={outTotal} color="var(--text)" assets={outgoing} onRemove={(a) => routeAsset(a.id, abbr)} />
      <Side label="Incoming" sign="+" total={inTotal} color="var(--text)" assets={incoming} onRemove={(a) => routeAsset(a.id, a.fromTeam)} />
      <div className="mt-1 flex items-center justify-between border-t border-[var(--border-soft)] pt-1">
        <span className="text-xs text-[var(--faint)]">Net salary</span>
        <span className="num text-xs font-semibold text-[var(--text)]">
          {net > 0 ? '+' : net < 0 ? '-' : ''}{m(Math.abs(net))}
        </span>
      </div>
      <details className="text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Exact salary amounts</summary><dl className="space-y-1 pb-2"><div className="flex justify-between gap-2"><dt>Outgoing salary</dt><dd className="num">{exactMoney(outTotal)}</dd></div><div className="flex justify-between gap-2"><dt>Incoming salary</dt><dd className="num">{exactMoney(inTotal)}</dd></div><div className="flex justify-between gap-2"><dt>Salary change</dt><dd className="num">{signedExactMoney(net)}</dd></div></dl></details>
      {hasCash && <dl className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--muted)]">
        <div className="flex items-center justify-between gap-2"><dt>Cash sent</dt><dd className="num">{cash(cashSent)}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt>Cash received</dt><dd className="num">{cash(cashReceived)}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt>Net cash</dt><dd className="num">{netCash > 0 ? '+' : netCash < 0 ? '−' : ''}{cash(Math.abs(netCash))}</dd></div>
      </dl>}
    </div>
  );
}
