import { describe, it, expect } from 'vitest';
import { allSeasons, teamCapSheet } from '../capSheet';
import type { TradeAsset } from '../types';

const p = (id: string, toTeam: string, fs: [string, number][]): TradeAsset => ({
  id,
  kind: 'player',
  salary: fs[0][1],
  fromTeam: 'AAA',
  toTeam,
  label: id,
  futureSalaries: fs.map(([season, salary]) => ({ season, salary })),
});

describe('capSheet', () => {
  const assets: TradeAsset[] = [
    p('stay', 'AAA', [['2025-26', 30_000_000], ['2026-27', 32_000_000]]),
    p('incoming', 'AAA', [['2025-26', 13_000_000], ['2026-27', 41_000_000]]), // the cliff
    p('left', 'BBB', [['2025-26', 20_000_000], ['2026-27', 21_000_000]]),
  ];

  it('lists the union of seasons sorted', () => {
    expect(allSeasons(assets)).toEqual(['2025-26', '2026-27']);
  });

  it('sums post-trade payroll per season for players that end on the team', () => {
    const sheet = teamCapSheet('AAA', assets, ['2025-26', '2026-27']);
    expect(sheet[0].total).toBe(43_000_000); // 30 + 13
    expect(sheet[1].total).toBe(73_000_000); // 32 + 41 — the cliff is visible
  });

  it('excludes players routed away from the team', () => {
    const sheet = teamCapSheet('BBB', assets, ['2025-26']);
    expect(sheet[0].total).toBe(20_000_000); // only the 'left' player
  });
});
