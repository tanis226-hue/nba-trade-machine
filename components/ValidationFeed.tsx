'use client';
import type { TradeValidation } from '@/lib/cba/types';

export function ValidationFeed({ validation }: { validation: TradeValidation }) {
  if (validation.valid) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--legal)]/30 bg-[var(--legal)]/10 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--legal)] text-sm font-bold text-black">✓</span>
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--legal)]">Trade Legal</div>
          <div className="text-xs text-[var(--muted)]">All teams satisfy CBA salary-matching and apron rules.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--illegal)]/30 bg-[var(--illegal)]/10 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--illegal)]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--illegal)] text-[11px] font-bold text-black">!</span>
        Trade Denied
      </div>
      <ul className="space-y-1">
        {validation.errors.map((e, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-[var(--text)]">
            <span className="num mt-0.5 shrink-0 rounded bg-[var(--illegal)]/20 px-1 text-[10px] font-semibold text-[var(--illegal)]">
              {e.teamAbbr}
            </span>
            <span>{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
