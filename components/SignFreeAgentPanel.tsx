'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { FreeAgent } from '@/lib/store/tradeStore';

import type { ToolUsage } from '@/lib/cba/types';
import { matchesPlayerName } from '@/lib/search';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const MIN_SALARY = 2_300_000; // approx 2026-27 vet minimum, used when no prior salary

const USING_OPTIONS: [string, string][] = [
  ['cap_room', 'Cap room'],
  ['minimum', 'Minimum'],
  ['bird', 'Bird rights'],
  ['non_taxpayer_mle', 'Non-taxpayer MLE'],
  ['taxpayer_mle', 'Taxpayer MLE'],
  ['bae', 'Bi-annual (BAE)'],
];
// Exceptions that hard-cap the team for the season (the rest don't).
const TOOL_FOR: Record<string, ToolUsage | undefined> = {
  non_taxpayer_mle: 'non_taxpayer_mle',
  taxpayer_mle: 'taxpayer_mle',
  bae: 'bae',
};

export function SignFreeAgentPanel({
  abbr,
  freeAgents,
  onClose,
}: {
  abbr: string;
  freeAgents: FreeAgent[];
  onClose: () => void;
}) {
  const signFreeAgent = useTradeStore((s) => s.signFreeAgent);
  const setTeamFlags = useTradeStore((s) => s.setTeamFlags);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<FreeAgent | null>(null);
  const [salaryM, setSalaryM] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [using, setUsing] = useState('cap_room');
  const dialogRef=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousFocus=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if(e.key==='Escape')onClose();
      if(e.key!=='Tab')return;
      const nodes=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(':is(button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href])')??[]);
      const first=nodes[0],last=nodes.at(-1);
      if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialogRef.current)){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('keydown', onKey);document.body.style.overflow=previousOverflow;previousFocus?.focus({preventScroll:true});};
  }, [onClose]);

  const matches = useMemo(() => freeAgents.filter(f=>matchesPlayerName(f.name,q)), [q, freeAgents]);
  const list=matches.slice(0,80);
  const proposedSalary=Number(salaryM)*1_000_000;
  const validSalary=salaryM.trim()!==''&&Number.isFinite(proposedSalary)&&proposedSalary>=1&&proposedSalary<=2_000_000_000;

  function pick(fa: FreeAgent) {
    setSelected(fa);
    setSalaryM(((fa.priorSalary || MIN_SALARY) / 1_000_000).toFixed(1));
    setRestricted(fa.restricted);
  }

  function sign() {
    if (!selected||!validSalary) return;
    const salary = Math.round(proposedSalary);
    signFreeAgent(abbr, { ...selected, restricted }, salary);
    // Record a hard-cap-triggering exception so the engine derives the team's hard cap / tool blocks.
    const tool = TOOL_FOR[using];
    if (tool) {
      const existing = useTradeStore.getState().teams.find((t) => t.abbr === abbr)?.toolsUsed ?? [];
      if (!existing.includes(tool)) setTeamFlags(abbr, { toolsUsed: [...existing, tool] });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Sign a free agent to ${abbr}`}
        onClick={(e) => e.stopPropagation()}
        className="panel ticked relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between bg-[var(--accent)] px-4 py-2.5">
          <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
            Sign free agent · {abbr}
          </span>
          <button onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 text-[var(--ink)]/80 transition hover:text-[var(--ink)]">
            ✕
          </button>
        </div>

        <div className="border-b border-[var(--border-soft)] p-3">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]" htmlFor={`free-agent-search-${abbr}`}>Search listed free agents across the league</label>
          <input
            ref={searchRef}
            id={`free-agent-search-${abbr}`}
            name="free-agent-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${freeAgents.length} free agents…`}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--muted)]"><p role="status">{matches.length} {matches.length===1?'match':'matches'}{matches.length>80?' · Showing the first 80; narrow your search.':''}</p>{q&&<button className="route-button min-h-11" aria-label="Clear free-agent search" onClick={()=>{setQ('');searchRef.current?.focus();}}>Clear</button>}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5">
          {list.length === 0 && <div className="px-2 py-6 text-center text-[13px] text-[var(--muted)]">No listed free agents match “{q}”. Try a last name or clear the search.</div>}
          {list.map((fa) => {
            const active = selected?.playerId === fa.playerId;
            return (
              <button
                key={fa.playerId}
                onClick={() => pick(fa)}
                aria-pressed={active}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                  active ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--surface-2)]/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--text)]">
                    {fa.name}
                    {fa.restricted && (
                      <span className="rounded bg-[var(--accent-2)]/20 px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--accent-2)]">RFA</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--faint)]">
                    {fa.position && <span>{fa.position}</span>}
                    {fa.age != null && <span>{fa.age} yo</span>}
                    {fa.value != null && <span className="font-semibold text-[var(--muted)]">{fa.value} GS</span>}
                    {fa.pts != null && <span>{fa.pts} pts</span>}
                  </div>
                </div>
                <span className="num shrink-0 text-[11px] text-[var(--muted)]">
                  prior {fa.priorSalary ? m(fa.priorSalary) : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="border-t border-[var(--border-soft)] bg-[var(--surface-2)]/40 p-3">
            <div className="mb-2 text-[12px] font-medium text-[var(--text)]">
              Sign <span className="font-bold">{selected.name}</span> to {abbr}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[var(--muted)]">$</span>
              <input
                aria-label="Annual salary in millions of dollars"
                aria-invalid={!validSalary}
                aria-describedby={!validSalary?`salary-error-${abbr}`:undefined}
                name="free-agent-salary"
                inputMode="decimal"
                type="number"
                step="0.000001"
                min="0.000001"
                max="2000"
                value={salaryM}
                onChange={(e) => setSalaryM(e.target.value)}
                className="num min-h-11 w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="num text-[var(--muted)]">M / yr</span>
              <select
                aria-label="Signing method"
                name="signing-method"
                value={using}
                onChange={(e) => setUsing(e.target.value)}
                title="Exception used to sign. NTMLE / Taxpayer-MLE / BAE hard-cap the team for the season."
                className="min-h-11 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11px] text-[var(--text)] outline-none"
              >
                {USING_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <div className="ml-2 flex overflow-hidden rounded border border-[var(--border)] text-[11px] font-semibold">
                {([['UFA', false], ['RFA', true]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    onClick={() => setRestricted(val)}
                    aria-pressed={restricted===val}
                    className={`min-h-11 min-w-11 px-2 py-1 transition ${restricted === val ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={sign}
                disabled={!validSalary}
                className="ml-auto min-h-11 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:brightness-110 disabled:opacity-50"
              >
                Sign
              </button>
            </div>
            {!validSalary&&<p id={`salary-error-${abbr}`} role="alert" className="mt-2 text-xs text-[var(--illegal)]">Enter an annual salary from $1 to $2 billion.</p>}
            <p className="mt-2 text-[11px] text-[var(--faint)]">
              Adds {selected.name} to {abbr}&rsquo;s payroll (cap + apron) and roster, where you can keep or trade the
              new contract. {restricted ? 'RFA: framed as an offer sheet / match.' : 'Signed as an unrestricted free agent.'}
              {' '}Exception/Bird/cap-room legality is approximate in this build.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
