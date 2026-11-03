'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTradeStore } from '@/lib/store/tradeStore';
import { selectValidation } from '@/lib/store/selectValidation';
import { defaultTradeDate } from '@/lib/data/freshness';
import { formatScenarioDate } from '@/lib/trades/scenario';
import { RULES_VERSION } from '@/lib/trades/snapshot';
import { compactMoney as m, exactMoney, signedMoney, signedExactMoney } from '@/lib/trades/presentation';
import { CashUsageNotes } from './CashUsageNotes';
import { PickDetails } from './PickDetails';
import { ValidationFeed } from './ValidationFeed';
import { formatCash as cash } from '@/lib/cba/cash';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';

type Phase = 'review' | 'processing' | 'done';
interface ReviewSnapshot {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate: string;
  tradeMethod: TradeMethod;
  dataVersion: string;
}

export function ExecuteTradeButton() {
  const teamCount = useTradeStore(s => s.teams.length);
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>('review');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewId = useRef(0);

  const validation = useMemo(() => snapshot ? selectValidation(snapshot) : null, [snapshot]);
  const hasMoves = snapshot && Object.values(snapshot.assets).some(a => a.fromTeam !== a.toTeam);
  const summaries = useMemo(() => snapshot?.teams.map(team => {
    const list = Object.values(snapshot.assets);
    const receives = list.filter(a => a.toTeam === team.abbr && a.fromTeam !== team.abbr);
    const sends = list.filter(a => a.fromTeam === team.abbr && a.toTeam !== team.abbr);
    const incoming = receives.reduce((n, a) => n + (a.kind === 'player' ? a.salary : 0), 0);
    const outgoing = sends.reduce((n, a) => n + (a.kind === 'player' ? a.salary : 0), 0);
    return { team, receives, sends, incoming, outgoing,
      cashReceived: receives.reduce((n, a) => n + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0),
      cashSent: sends.reduce((n, a) => n + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0),
    };
  }) ?? [], [snapshot]);

  const close = useCallback(() => {
    if (requestRef.current) return;
    reviewId.current += 1;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setSnapshot(null);
    setPhase('review');
    setShareUrl(null);
    setError(null);
    setCopyError(false);
    setCopied(false);
    triggerRef.current?.focus();
  }, []);

  function start() {
    reviewId.current += 1;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const state = useTradeStore.getState();
    // Freeze exactly what is reviewed, including the effective date. Subsequent board changes
    // or a delayed response cannot change the proposal behind this modal.
    setSnapshot(JSON.parse(JSON.stringify({
      season: state.season, teams: state.teams, assets: state.assets,
      simulatedDate: state.simulatedDate ?? defaultTradeDate(state.season),
      tradeMethod: state.tradeMethod, dataVersion: state.dataVersion ?? 'custom-unversioned',
    })));
    setPhase('review');
    setShareUrl(null);
    setError(null);
    setCopyError(false);
    setCopied(false);
  }

  async function confirm() {
    if (!snapshot || snapshot.teams.length < 2 || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    setError(null);
    setPhase('processing');
    try {
      const res = await fetch('/api/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot), signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.slug !== 'string' || !/^[A-Za-z0-9_-]{10}$/.test(data.slug)) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save this proposal. Please try again.');
      }
      setShareUrl(`${location.origin}/trade/${data.slug}`);
      setPhase('done');
    } catch (error) {
      setError(controller.signal.aborted ? 'Saving took too long. Your reviewed proposal is still here; try saving again.' : error instanceof Error ? error.message : 'Could not save this proposal. Please try again.');
      setPhase('review');
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    const copiedReview = reviewId.current;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (copiedReview !== reviewId.current) return;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (copiedReview !== reviewId.current) return;
      setCopied(false);
      setCopyError(true);
    }
  }

  useEffect(() => {
    if (!snapshot) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(':is(button:not(:disabled), input:not(:disabled), a[href], summary)') ?? [])
        .filter(node => {
          const details = node.closest('details:not([open])');
          return !details || details.querySelector('summary') === node;
        });
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [snapshot, phase, close]);

  useEffect(() => () => {
    reviewId.current += 1;
    requestRef.current?.abort();
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  return <>
    <button onClick={start} disabled={teamCount === 0} className="ui-button primary min-h-11 w-full">Review &amp; Share</button>
    {snapshot && validation && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4" onClick={close}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="proposal-review-title" aria-busy={phase === 'processing'} tabIndex={-1}
          onClick={event => event.stopPropagation()} className="panel relative max-h-[90dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-xl p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 id="proposal-review-title" className="text-lg font-bold">{phase === 'done' ? 'Snapshot saved' : 'Review proposal'}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{snapshot.season} · {formatScenarioDate(snapshot.simulatedDate)} · {snapshot.tradeMethod === 'non_simultaneous' ? 'Trade exception method' : 'Standard trade'}</p>
            </div>
            <button onClick={close} disabled={phase === 'processing'} aria-label="Close review" className="ui-button min-h-11 min-w-11">×</button>
          </div>
          {phase !== 'done' ? <>
            {hasMoves ? <ValidationFeed validation={validation} hideRules/> : <div className="rounded-lg bg-[var(--surface-2)] p-3 text-sm"><strong>Draft: no assets included</strong><p className="mt-1 text-[var(--muted)]">You can share this starting board. No trade verdict applies until an asset changes teams.</p></div>}
            <details className="my-3 text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Snapshot details &amp; assumptions</summary>
              <p className="break-all">Roster data version: {snapshot.dataVersion}. Rules: {RULES_VERSION}.</p>
              <p className="mt-2 leading-relaxed">The link preserves the reviewed inputs, trade date, and modeled checks. Editing your board afterward will not update this link. Any unresolved issues stay visible.</p>
              {!hasMoves && snapshot.teams.some(team => team.dataNotes?.length) && <ul className="mt-2 list-disc space-y-1 pl-4">{snapshot.teams.flatMap(team => (team.dataNotes ?? []).map((note, index) => <li key={`${team.abbr}-${index}`}>{team.abbr}: {note}</li>))}</ul>}
            </details>
            <div className="space-y-3">{summaries.map(s => {
              const net = s.incoming - s.outgoing;
              const netCash = s.cashReceived - s.cashSent;
              const hasCash = [...s.receives, ...s.sends].some(a => a.kind === 'cash');
              const after = validation.perTeam.find(t => t.abbr === s.team.abbr)?.postSalary ?? s.team.preTradeSalary + net;
              return <div key={s.team.abbr} role="region" aria-label={`${s.team.abbr} proposal summary`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{s.team.abbr}</span><span className="num text-xs text-[var(--text)]">Net salary {signedMoney(net)}</span></div>
                <div className="grid grid-cols-2 gap-3 text-xs"><AssetList title="Receives" items={s.receives} total={s.incoming}/><AssetList title="Sends" items={s.sends} total={s.outgoing}/></div>
                <details className="mt-2 text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Exact salary amounts</summary><dl className="space-y-1"><div className="flex justify-between gap-2"><dt>Team salary before</dt><dd className="num">{exactMoney(s.team.preTradeSalary)}</dd></div><div className="flex justify-between gap-2"><dt>Team salary after</dt><dd className="num">{exactMoney(after)}</dd></div><div className="flex justify-between gap-2"><dt>Salary change</dt><dd className="num">{signedExactMoney(after - s.team.preTradeSalary)}</dd></div>{[...s.receives, ...s.sends].filter(a => a.kind === 'player').map(a => <div key={a.id} className="flex justify-between gap-2"><dt>{a.label}</dt><dd className="num">{exactMoney(a.salary)}</dd></div>)}</dl></details>
                {hasCash && <><dl className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--muted)]"><div className="flex justify-between gap-2"><dt>Cash sent</dt><dd className="num">{cash(s.cashSent)}</dd></div><div className="flex justify-between gap-2"><dt>Cash received</dt><dd className="num">{cash(s.cashReceived)}</dd></div><div className="flex justify-between gap-2"><dt>Net cash</dt><dd className="num">{netCash > 0 ? '+' : netCash < 0 ? '−' : ''}{cash(Math.abs(netCash))}</dd></div></dl><CashUsageNotes team={s.team} season={snapshot.season}/></>}
              </div>;
            })}</div>
            {error && <p role="alert" className="mt-3 text-sm text-[var(--illegal)]">{error}</p>}
            {snapshot.teams.length < 2 && <p className="mt-3 text-sm text-[var(--muted)]">Add a second team to create a shareable draft.</p>}
            <div className="mt-4 flex gap-2"><button onClick={close} disabled={phase === 'processing'} className="ui-button min-h-11 flex-1">Cancel</button><button onClick={confirm} disabled={phase === 'processing' || snapshot.teams.length < 2} className="ui-button primary min-h-11 flex-1">{phase === 'processing' ? 'Saving snapshot…' : 'Save & Share'}</button></div>
            {phase === 'processing' && <p role="status" className="mt-2 text-sm text-[var(--muted)]">Saving the proposal shown above…</p>}
          </> : <div className="space-y-3 py-4">
            <p role="status" className="text-sm">{hasMoves ? 'Your proposal is saved, including its checks and assumptions.' : 'Your starting board is saved as a draft with no assets included.'}</p>
            <p className="text-sm text-[var(--muted)]">This link stays unchanged when you edit your working board.</p>
            {shareUrl && <><label className="block text-sm font-medium">Saved proposal link<input readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} className="ui-input num mt-2 w-full text-xs"/></label><button onClick={copyLink} className="ui-button primary min-h-11 w-full">{copied ? 'Link copied ✓' : 'Copy share link'}</button><a href={shareUrl} className="ui-button min-h-11 w-full">Open saved proposal</a></>}
            {copyError && <p role="status" className="text-sm text-[var(--muted)]">Copy is unavailable in this browser. Select the link above and copy it manually.</p>}
            <button onClick={close} className="ui-button min-h-11 w-full">Keep editing</button>
          </div>}
        </div>
      </div>, document.body)}
  </>;
}

function AssetList({ title, items, total }: { title: string; items: TradeAsset[]; total: number }) {
  return <div><h3 className="mb-1 font-semibold text-[var(--muted)]">{title}</h3>
    {items.length === 0 ? <p className="text-[var(--muted)]">Nothing included</p> : <ul className="space-y-2">{items.map(a => <li key={a.id}><span className="block break-words">{a.label}</span><span className="text-[var(--muted)]">{title === 'Receives' ? `From ${a.fromTeam}` : `To ${a.toTeam}`}</span>{a.kind === 'cash' ? <span className="num ml-2">{cash(a.amount ?? 0)}</span> : a.kind === 'player' && <span className="num ml-2">{m(a.salary)}</span>}{a.kind === 'pick' && <details className="mt-1"><summary className="min-h-11 cursor-pointer py-3">Pick rights &amp; conditions</summary><PickDetails asset={a}/></details>}</li>)}</ul>}
    <p className="num mt-2 border-t border-[var(--border-soft)] pt-1 text-[var(--muted)]">Salary {m(total)}</p>
  </div>;
}
