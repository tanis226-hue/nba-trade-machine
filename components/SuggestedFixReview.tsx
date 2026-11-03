'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FixAction } from '@/lib/cba/autofix';
import { partializeTradeState, useTradeStore } from '@/lib/store/tradeStore';
import { previewFix, workingStateKey } from '@/lib/store/reviewedFix';
import { defaultTradeDate } from '@/lib/data/freshness';
import { ValidationFeed } from './ValidationFeed';

export function SuggestedFixReview({ actions, onClose }: { actions: FixAction[]; onClose: () => void }) {
  // Freeze the proposal the user opened, so a changing board cannot silently change the offer.
  const [review] = useState(() => {
    const state = partializeTradeState(useTradeStore.getState());
    const frozenActions = actions.map(action => ({ ...action }));
    return { state, actions: frozenActions, preview: previewFix(state, frozenActions) };
  });
  const currentKey = useTradeStore(workingStateKey);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const preview = review.preview;
  const stale = currentKey !== workingStateKey(review.state);
  const removals = preview?.changes.filter(change => change.removed) ?? [];

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else document.getElementById('trade-check-heading')?.focus({ preventScroll: true });
    };
  }, []);

  function apply() {
    if (!preview || !useTradeStore.getState().applyReviewedFix(review.actions, preview.key)) {
      setError('This preview no longer applies. Close it and review a new suggestion.');
      return;
    }
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-description`}
        className="panel max-h-[calc(100dvh-32px)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl p-5"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
          if (event.key !== 'Tab') return;
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(':is(button:not(:disabled),a[href],input:not(:disabled),summary)') ?? []);
          const first = controls[0], last = controls.at(-1);
          if (!first || !last) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
            event.preventDefault(); first.focus();
          }
        }}>
        <h2 id={id} className="text-xl font-bold">Review suggested changes</h2>
        <p id={`${id}-description`} className="mt-2 text-sm text-[var(--muted)]">Check what this suggestion gives up before applying it. Your date, contract inputs, and assumptions stay the same.</p>
        <p className="mt-2 text-xs text-[var(--muted)]">{review.state.season} · Trade date {review.state.simulatedDate ?? defaultTradeDate(review.state.season)}</p>
        {preview ? <>
          <ul className="my-4 space-y-3">
            {preview.changes.map(change => <li key={change.assetId} className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <strong className="block">{change.label}</strong>
              {change.removed
                ? <span>Remove from the trade. {change.previousDestination} will no longer receive this asset; it stays with {change.origin}.</span>
                : <span>Change destination from {change.previousDestination} to {change.destination}. Originally from {change.origin}.</span>}
            </li>)}
          </ul>
          {removals.length > 0 && <p className="mb-3 text-sm font-semibold">This changes your proposed return. It does not find a replacement for the removed {removals.length === 1 ? 'asset' : 'assets'}.</p>}
          <h3 className="mb-2 text-sm font-semibold">Checks after these changes</h3>
          <ValidationFeed validation={preview.validation} hideRules />
          <p className="mt-3 text-xs text-[var(--muted)]">All modeled checks were rerun for this preview. You can undo the applied changes before making another edit.</p>
        </> : <p className="mt-4 text-sm">No usable suggestion is available for this proposal. Keep editing and check again.</p>}
        {stale && <p role="alert" className="mt-3 text-sm text-[var(--warn)]">Your proposal changed while this preview was open. Close it and review a new suggestion.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--illegal)]">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="ui-button" onClick={onClose}>Keep editing</button>
          <button className="ui-button primary" disabled={stale || !preview?.validation.valid} onClick={apply}>Apply {preview?.changes.length ?? 0} {preview?.changes.length === 1 ? 'change' : 'changes'}</button>
        </div>
      </div>
    </div>, document.body,
  );
}
