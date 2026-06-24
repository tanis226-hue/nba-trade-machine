'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { FreeAgent } from '@/lib/store/tradeStore';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const MIN_SALARY = 2_300_000; // approx 2026-27 vet minimum, used when no prior salary

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
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<FreeAgent | null>(null);
  const [salaryM, setSalaryM] = useState('');
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? freeAgents.filter((f) => f.name.toLowerCase().includes(needle)) : freeAgents;
    return base.slice(0, 80);
  }, [q, freeAgents]);

  function pick(fa: FreeAgent) {
    setSelected(fa);
    setSalaryM(((fa.priorSalary || MIN_SALARY) / 1_000_000).toFixed(1));
    setRestricted(fa.restricted);
  }

  function sign() {
    if (!selected) return;
    const salary = Math.max(0, Math.round((parseFloat(salaryM) || 0) * 1_000_000));
    signFreeAgent(abbr, { ...selected, restricted }, salary || MIN_SALARY);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
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
          <button onClick={onClose} aria-label="Close" className="text-[var(--ink)]/80 transition hover:text-[var(--ink)]">
            ✕
          </button>
        </div>

        <div className="border-b border-[var(--border-soft)] p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${freeAgents.length} free agents…`}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {list.length === 0 && <div className="px-2 py-6 text-center text-[13px] text-[var(--muted)]">No matches.</div>}
          {list.map((fa) => {
            const active = selected?.playerId === fa.playerId;
            return (
              <button
                key={fa.playerId}
                onClick={() => pick(fa)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
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
                type="number"
                step="0.1"
                min="0"
                value={salaryM}
                onChange={(e) => setSalaryM(e.target.value)}
                className="num w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="num text-[var(--muted)]">M / yr</span>
              <div className="ml-2 flex overflow-hidden rounded border border-[var(--border)] text-[11px] font-semibold">
                {([['UFA', false], ['RFA', true]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    onClick={() => setRestricted(val)}
                    className={`px-2 py-1 transition ${restricted === val ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={sign}
                className="ml-auto rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:brightness-110"
              >
                Sign
              </button>
            </div>
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
