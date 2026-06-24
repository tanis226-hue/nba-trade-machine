'use client';
import { useMemo } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { gradeTrade } from '@/lib/cba/grade';

export function TradeGrade() {
  const teams = useTradeStore((s) => s.teams);
  const assetsMap = useTradeStore((s) => s.assets);
  const grade = useMemo(() => gradeTrade(teams, Object.values(assetsMap)), [teams, assetsMap]);
  const moved = grade.teams.some((t) => t.inValue > 0 || t.outValue > 0);
  if (!moved) return null;

  return (
    <div className="panel rounded-xl p-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-display text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Trade value grade
        </span>
        <span
          className="text-[12px] font-semibold"
          style={{ color: grade.favored ? 'var(--accent)' : 'var(--legal)' }}
        >
          {grade.verdict}
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${grade.teams.length}, minmax(0, 1fr))` }}>
        {grade.teams.map((t) => (
          <div key={t.abbr} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)]/40 p-2">
            <div className="font-display text-sm font-bold text-[var(--text)]">{t.abbr}</div>
            <div className="num text-[11px] text-[var(--legal)]">+{t.inValue} in</div>
            <div className="num text-[11px] text-[var(--muted)]">−{t.outValue} out</div>
            <div
              className="num text-[12px] font-semibold"
              style={{ color: t.net > 0 ? 'var(--legal)' : t.net < 0 ? 'var(--illegal)' : 'var(--muted)' }}
            >
              Net {t.net > 0 ? '+' : ''}
              {t.net}
            </div>
            <div className="num text-[10px] text-[var(--faint)]">
              Cap value {t.surplusNet > 0 ? '+' : ''}
              {t.surplusNet}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10px] text-[var(--faint)]">
        Talent = per-game Game Score (2025-26) + draft-pick curve. Cap value adjusts for salary taken on
        (a star on a rookie deal beats the same star on a max).
      </div>
    </div>
  );
}
