'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset } from '@/lib/cba/types';

type Phase = 'review' | 'processing' | 'done';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${m(Math.abs(n))}`;

interface TeamSummary {
  abbr: string;
  receives: TradeAsset[];
  sends: TradeAsset[];
  incoming: number;
  outgoing: number;
}

export function ExecuteTradeButton({ valid, onExecute }: { valid: boolean; onExecute: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('review');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const simulatedDate = useTradeStore((s) => s.simulatedDate);
  const tradeMethod = useTradeStore((s) => s.tradeMethod);
  const dialogRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summaries = useMemo<TeamSummary[]>(() => {
    const list = Object.values(assets);
    return teams.map((t) => {
      // Only assets that actually change teams — exclude Stay assets (fromTeam===toTeam), same as the engine.
      const receives = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
      const sends = list.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
      return {
        abbr: t.abbr,
        receives,
        sends,
        incoming: receives.reduce((n, a) => n + (a.salary || 0), 0),
        outgoing: sends.reduce((n, a) => n + (a.salary || 0), 0),
      };
    });
  }, [teams, assets]);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setPhase('review');
    setShareUrl(null);
  }, []);

  const start = useCallback(() => {
    setPhase('review');
    setShareUrl(null);
    setOpen(true);
  }, []);

  // Finalizing persists the trade to a shareable slug (same endpoint as Generate Link).
  const confirm = useCallback(async () => {
    setPhase('processing');
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        body: JSON.stringify({ season, teams, assets, simulatedDate, tradeMethod }),
      });
      const { slug } = await res.json();
      if (slug) setShareUrl(`${location.origin}/trade/${slug}`);
    } catch {
      /* offline / save failed — still show the finalized state */
    }
    onExecute();
    setPhase('done');
  }, [onExecute, season, teams, assets, simulatedDate, tradeMethod]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }, [shareUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'processing') close();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, phase, close]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <>
      <button
        onClick={start}
        disabled={!valid}
        className={`w-full rounded-lg py-3 font-display text-base font-bold uppercase tracking-[0.12em] transition ${
          valid
            ? 'bg-[var(--accent)] text-[var(--ink)] shadow-[0_0_30px_-6px_var(--accent)] hover:brightness-110'
            : 'cursor-not-allowed bg-[var(--surface-2)] text-[var(--faint)]'
        }`}
      >
        Finalize Trade
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => phase !== 'processing' && close()}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Finalize trade"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="panel relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 outline-none"
          >
            {phase === 'review' && (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-[var(--text)]">
                      Confirm Trade
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {summaries.length}-team deal • review before finalizing
                    </p>
                  </div>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="rounded p-1 text-[var(--faint)] transition hover:text-[var(--text)]"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  {summaries.map((s) => {
                    const net = s.incoming - s.outgoing;
                    return (
                      <div key={s.abbr} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-display text-sm font-bold tracking-[0.08em] text-[var(--text)]">
                            {s.abbr}
                          </span>
                          <span
                            className={`num text-[12px] font-semibold ${
                              net > 0 ? 'text-[var(--illegal)]' : net < 0 ? 'text-[var(--legal)]' : 'text-[var(--muted)]'
                            }`}
                          >
                            Net {signed(net)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[12px]">
                          <AssetList title="Receives" items={s.receives} total={s.incoming} accent />
                          <AssetList title="Sends" items={s.sends} total={s.outgoing} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={close}
                    className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirm}
                    className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-[var(--ink)] shadow-[0_0_30px_-8px_var(--accent)] transition hover:brightness-110"
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}

            {phase === 'processing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-14" aria-live="polite">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                <p className="font-display text-sm uppercase tracking-[0.16em] text-[var(--muted)]">Processing…</p>
              </div>
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" aria-live="polite">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--legal)]/15 text-2xl text-[var(--legal)]">
                  ✓
                </div>
                <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-[var(--text)]">
                  Trade Finalized
                </h2>
                <p className="max-w-xs text-[13px] text-[var(--muted)]">
                  {shareUrl ? 'Saved. Share the link to get reactions and run it past the league.' : 'Your deal is locked in.'}
                </p>
                {shareUrl && (
                  <div className="mt-1 w-full max-w-sm space-y-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="num w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-center text-xs text-[var(--muted)] outline-none"
                    />
                    <button
                      onClick={copyLink}
                      className="w-full rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-[var(--ink)] transition hover:brightness-110"
                    >
                      {copied ? 'Link copied ✓' : 'Copy share link'}
                    </button>
                  </div>
                )}
                <button
                  onClick={close}
                  className="text-[12px] text-[var(--faint)] transition hover:text-[var(--muted)]"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AssetList({ title, items, total, accent }: { title: string; items: TradeAsset[]; total: number; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">{title}</div>
      {items.length === 0 ? (
        <div className="text-[var(--faint)]">—</div>
      ) : (
        <ul className="space-y-0.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-2">
              <span className={`truncate ${accent ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{a.label}</span>
              {a.salary > 0 && <span className="num shrink-0 text-[11px] text-[var(--faint)]">{m(a.salary)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 border-t border-[var(--border-soft)] pt-1 num text-[11px] text-[var(--muted)]">
        {m(total)}
      </div>
    </div>
  );
}
