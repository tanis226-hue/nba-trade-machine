'use client';
import { useEffect, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { DATA_AS_OF } from '@/lib/data/freshness';
import type { TradeAsset } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const OPT: Record<string, string> = { team: 'Team option', player: 'Player option', eto: 'Early termination', guaranteed: 'Guaranteed', non_guaranteed: 'Non-guaranteed', two_way: 'Two-way' };

export function PlayerContractModal({
  asset,
  contract,
  onClose,
}: {
  asset: TradeAsset;
  contract?: ContractYear[];
  onClose: () => void;
}) {
  const setAssetSalary = useTradeStore((s) => s.setAssetSalary);
  const setAssetFlags = useTradeStore((s) => s.setAssetFlags);
  const [val, setVal] = useState((asset.salary / 1_000_000).toFixed(1));
  const edited = asset.origSalary != null && asset.salary !== asset.origSalary;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save() {
    const n = Math.max(0, Math.round(parseFloat(val) * 1_000_000) || 0);
    setAssetSalary(asset.id, n);
  }
  function reset() {
    if (asset.origSalary == null) return;
    setAssetSalary(asset.id, asset.origSalary);
    setVal((asset.origSalary / 1_000_000).toFixed(1));
  }

  const stat = (label: string, v?: number) => (
    <div className="flex flex-col items-center">
      <span className="num text-lg font-bold text-[var(--text)]">{v ?? '—'}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--faint)]">{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${asset.label} contract`}
        onClick={(e) => e.stopPropagation()}
        className="panel ticked relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl"
      >
        <div className="flex items-center justify-between bg-[var(--accent)] px-4 py-2.5">
          <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
            {asset.fromTeam} Contract
          </span>
          <button onClick={onClose} aria-label="Close" className="text-[var(--ink)]/80 transition hover:text-[var(--ink)]">
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-4">
            <Photo src={asset.headshot} name={asset.label} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-[var(--text)]">
                {asset.label}
              </h2>
              <div className="mt-1 text-[12px] text-[var(--muted)]">
                {[asset.position, asset.jersey ? `#${asset.jersey}` : null, asset.height, asset.weight ? `${asset.weight} lbs` : null, asset.age != null ? `${asset.age} yo` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {asset.pts != null && (
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2">
                  {stat('PTS', asset.pts)}
                  {stat('REB', asset.reb)}
                  {stat('AST', asset.ast)}
                  {stat('GS', asset.value)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="eyebrow mb-2">Contract</div>
            {contract && contract.length > 0 ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
                    <th className="py-1 text-left font-normal">Season</th>
                    <th className="py-1 text-right font-normal">Salary</th>
                    <th className="py-1 text-right font-normal">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.map((c) => (
                    <tr key={c.season} className="border-t border-[var(--border-soft)]">
                      <td className="num py-1.5 text-[var(--muted)]">{c.season}</td>
                      <td className="num py-1.5 text-right text-[var(--text)]">{m(c.salary)}</td>
                      <td className="py-1.5 text-right text-[11px] text-[var(--muted)]">
                        {OPT[c.option_type] ?? c.option_type}
                        {c.no_trade_clause ? ' · NTC' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-[13px] text-[var(--muted)]">No multi-year contract data.</div>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
            <div className="eyebrow mb-2">Modify current-season salary</div>
            <div className="flex items-center gap-2">
              <span className="num text-[var(--muted)]">$</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="num w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="num text-[var(--muted)]">M</span>
              <button
                onClick={save}
                className="ml-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:brightness-110"
              >
                Apply
              </button>
              {edited && (
                <button onClick={reset} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]">
                  Reset
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-[var(--faint)]">
              Changing the salary re-runs CBA matching and the cap meters instantly. {edited && <span className="text-[var(--accent)]">Edited from {m(asset.origSalary!)}.</span>}
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
            <div className="eyebrow mb-2">CBA attributes</div>
            <div className="flex flex-wrap gap-1.5">
              <Flag label="Two-way" on={!!asset.isTwoWay} hint="Two-way contract: counts toward the 3-per-team limit." onToggle={() => setAssetFlags(asset.id, { isTwoWay: !asset.isTwoWay })} />
              <Flag label="Base-year comp" on={!!asset.isBaseYearComp} hint="Re-signed via S&T: outgoing matches at max(50% new, prior salary)." onToggle={() => setAssetFlags(asset.id, { isBaseYearComp: !asset.isBaseYearComp, bycPriorSalary: asset.bycPriorSalary ?? asset.origSalary })} />
              <Flag label="Poison pill" on={!!asset.isRookieScaleExtension} hint="Rookie-scale extension: the acquiring team matches at the contract's average annual value." onToggle={() => setAssetFlags(asset.id, { isRookieScaleExtension: !asset.isRookieScaleExtension })} />
              <Flag label="Over-38" on={!!asset.isOver38} hint="Over-38 rule: cap hit is reallocated to earlier seasons." onToggle={() => setAssetFlags(asset.id, { isOver38: !asset.isOver38 })} />
              <Flag label="S&T" on={asset.signedVia === 'sign_and_trade'} hint="Acquired via sign-and-trade (hard-caps the acquirer at the first apron; 3-4 yr term)." onToggle={() => setAssetFlags(asset.id, { signedVia: asset.signedVia === 'sign_and_trade' ? undefined : 'sign_and_trade' })} />
              <Flag label="Designated vet" on={!!asset.designatedVetDate} hint="Supermax extension: cannot be traded for 1 year after signing." onToggle={() => setAssetFlags(asset.id, { designatedVetDate: asset.designatedVetDate ? undefined : DATA_AS_OF })} />
              <Flag label="Matched RFA" on={!!asset.matchedOfferDate} hint="Matched offer sheet: 1-year no-trade without consent." onToggle={() => setAssetFlags(asset.id, { matchedOfferDate: asset.matchedOfferDate ? undefined : DATA_AS_OF })} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-[var(--muted)]">Trade kicker</span>
              <input
                type="number" min="0" max="15" step="1"
                value={asset.tradeBonusPct ? Math.round(asset.tradeBonusPct * 100) : ''}
                onChange={(e) => setAssetFlags(asset.id, { tradeBonusPct: e.target.value ? Math.min(15, Math.max(0, Number(e.target.value))) / 100 : undefined })}
                className="num w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--muted)]">% of salary, added to the acquiring team&rsquo;s incoming match.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Flag({ label, on, hint, onToggle }: { label: string; on: boolean; hint: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={hint}
      className={`rounded px-2 py-1 text-[11px] font-semibold transition ${on ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'}`}
    >
      {label}
    </button>
  );
}

function Photo({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  if (!src || err) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] font-display text-2xl font-bold text-[var(--muted)] ring-1 ring-[var(--border)]">
        {initials}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} onError={() => setErr(true)} className="h-20 w-20 shrink-0 rounded-xl bg-[var(--surface-2)] object-cover object-top ring-1 ring-[var(--border)]" />
  );
}
