'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import { allSeasons, teamCapSheet } from '@/lib/cba/capSheet';
import { SEASON_2026_27 as CAP } from '@/lib/cba/constants';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

// Color a payroll cell by which cap line it crosses (using 2026-27 landmarks as the reference).
function tierColor(total: number): string {
  if (total <= 0) return 'var(--faint)';
  if (total >= CAP.secondApron) return 'var(--tier-apron2)';
  if (total >= CAP.firstApron) return 'var(--tier-apron1)';
  if (total >= CAP.taxLine) return 'var(--tier-tax)';
  return 'var(--text)';
}

/** Post-trade year-by-year payroll for every team in the deal — the forward cap sheet. */
export function CapSheet() {
  const teams = useTradeStore((s) => s.teams);
  const assetsMap = useTradeStore((s) => s.assets);
  const assets = Object.values(assetsMap);
  const seasons = allSeasons(assets);
  if (seasons.length < 2 || teams.length === 0) return null;

  return (
    <div className="panel rounded-xl p-3.5">
      <div className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        Forward cap sheet · post-trade
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[var(--faint)]">
              <th className="text-left font-medium">Team</th>
              {seasons.map((s) => (
                <th key={s} className="px-2 text-right font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const sheet = teamCapSheet(t.abbr, assets, seasons);
              return (
                <tr key={t.abbr} className="border-t border-[var(--border-soft)]">
                  <td className="py-1 font-display font-semibold text-[var(--text)]">{t.abbr}</td>
                  {sheet.map((c) => (
                    <td key={c.season} className="num px-2 py-1 text-right" style={{ color: tierColor(c.total) }}>
                      {c.total > 0 ? m(c.total) : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
