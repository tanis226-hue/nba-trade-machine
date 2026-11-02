'use client';
import type { TradeValidation, TradeFinding, Severity } from '@/lib/cba/types';
import type { FixSuggestion } from '@/lib/cba/autofix';
import { TradeRulesButton } from './TradeRules';

const STYLE: Record<Severity, { color: string; label: string }> = {
  block: { color: 'var(--illegal)', label: 'Illegal' },
  warning: { color: 'var(--warn)', label: 'Warning' },
  conditional: { color: 'var(--info)', label: 'Conditional' },
  info: { color: 'var(--muted)', label: 'Note' },
};

function Finding({ f }: { f: TradeFinding }) {
  const s = STYLE[f.severity];
  return (
    <li className="flex gap-2 text-[13px] text-[var(--text)]">
      {f.teamAbbr && (
        <span
          className="num mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold"
          style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 16%, transparent)` }}
        >
          {f.teamAbbr}
        </span>
      )}
      <span className="min-w-0">
        <span>{f.message}</span>
        {f.legalOnDate && (
          <span className="ml-1 font-semibold" style={{ color: STYLE.conditional.color }}>
            — legal on {f.legalOnDate}
          </span>
        )}
        {f.fix && <span className="block text-[11px] text-[var(--muted)]">Fix: {f.fix}</span>}
        {f.citation && <span className="block text-[10px] italic text-[var(--faint)]">{f.citation}</span>}
      </span>
    </li>
  );
}

export function ValidationFeed({
  validation,
  fixes = [],
  onAutoFix,
  autoFixCount = 0,
  hideRules = false,
}: {
  validation: TradeValidation;
  fixes?: FixSuggestion[];
  onAutoFix?: () => void;
  autoFixCount?: number;
  hideRules?: boolean;
}) {
  const findings = validation.findings ?? validation.errors;
  const blocks = findings.filter((f) => f.severity === 'block');
  const notes = findings.filter((f) => f.severity !== 'block');
  const valid = blocks.length === 0;
  const needsReview=notes.some(f=>f.severity==='conditional'||f.severity==='warning');
  const statusColor=!valid?'var(--illegal)':needsReview?'var(--info)':'var(--legal)';

  return (
    <div
      className="validation-feed rounded-xl border px-4 py-3"
      style={{
        borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
      }}
    >
      <div
        className="mb-1.5 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide"
        style={{ color: statusColor }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-[var(--ink)]"
          style={{ backgroundColor: statusColor }}
        >
          {valid ? '✓' : '!'}
        </span>
        {valid ? needsReview?'Review assumptions':'Passes modeled checks' : 'Trade needs changes'}
        {!hideRules&&<TradeRulesButton className="ml-auto bg-transparent text-[var(--muted)] hover:text-[var(--text)]" />}
      </div>

        {blocks.length > 0 && (
        <ul className="space-y-1.5">
          {blocks.slice(0,2).map((f, i) => (
            <Finding key={`b${i}`} f={f} />
          ))}
        </ul>
      )}

      {blocks.length>2&&<details className="mt-3"><summary className="min-h-10 text-xs font-semibold">{blocks.length-2} more {blocks.length===3?'issue':'issues'} to resolve</summary><ul className="mt-2 space-y-3">{blocks.slice(2).map((f,i)=><Finding key={i} f={f}/>)}</ul></details>}
      {notes.length > 0 && (
        <details className="mt-3 border-t border-[var(--border)] pt-2"><summary className="min-h-10 text-xs font-semibold">{notes.length} {notes.length===1?'note':'notes'} &amp; assumptions</summary><ul className="mt-2 space-y-3">
          {notes.map((f, i) => (
            <Finding key={`n${i}`} f={f} />
          ))}
        </ul></details>
      )}

      {valid && notes.length === 0 && (
        <div className="text-xs text-[var(--muted)]">No blocking findings for the supplied salaries and assumptions.</div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
        A simulation, not league approval. Active roster counts, team transaction history, and some pick conditions are incomplete.
      </p>

      {fixes.length > 0 && (
        <details className="mt-2 border-t border-[var(--border)] pt-2">
          <summary className="min-h-10 text-xs font-semibold">Suggested adjustments</summary>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-display text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              Try a change, then recheck
            </span>
            {onAutoFix && autoFixCount > 0 && (
              <button
                onClick={onAutoFix}
                title="Apply the minimal change to make the trade legal"
                className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink)] transition hover:brightness-110"
              >
                Apply suggested fix
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {fixes.map((f, i) => (
              <li key={i} className="text-[12px] text-[var(--muted)]">
                → {f.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
