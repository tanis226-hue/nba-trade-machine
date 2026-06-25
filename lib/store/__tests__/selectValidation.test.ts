import { describe, it, expect } from 'vitest';
import { selectValidation } from '@/lib/store/selectValidation';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

describe('selectValidation', () => {
  it('validates a legal swap built from store shape', () => {
    const r = selectValidation({
      season: '2025-26',
      teams: [
        { abbr: 'AAA', preTradeSalary: 120_000_000 },
        { abbr: 'BBB', preTradeSalary: 120_000_000 },
      ],
      assets: {
        a1: { id: 'a1', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        b1: { id: 'b1', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      },
    });
    expect(r.valid).toBe(true);
  });
});

const tw = (id: string, from: string, to: string): TradeAsset => ({
  id, kind: 'player', salary: 600_000, fromTeam: from, toTeam: to, label: id, isTwoWay: true,
});
const teams: TradeTeamInput[] = [
  { abbr: 'AAA', preTradeSalary: 150_000_000 },
  { abbr: 'BBB', preTradeSalary: 150_000_000 },
];
const out = { id: 'out', kind: 'player' as const, salary: 600_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'out' };

describe('selectValidation two-way derivation', () => {
  it('derives twoWayCount from flagged players and fires TWO_WAY_OVER over 3', () => {
    const assets: Record<string, TradeAsset> = {
      a1: tw('a1', 'AAA', 'AAA'), a2: tw('a2', 'AAA', 'AAA'), a3: tw('a3', 'AAA', 'AAA'),
      in: tw('in', 'BBB', 'AAA'), out,
    };
    expect((selectValidation({ season: '2026-27', teams, assets }).findings ?? []).map((f) => f.code)).toContain('TWO_WAY_OVER');
  });

  it('does not fire when within the 3 two-way limit', () => {
    const assets: Record<string, TradeAsset> = {
      a1: tw('a1', 'AAA', 'AAA'), a2: tw('a2', 'AAA', 'AAA'),
      in: tw('in', 'BBB', 'AAA'), out,
    };
    expect((selectValidation({ season: '2026-27', teams, assets }).findings ?? []).map((f) => f.code)).not.toContain('TWO_WAY_OVER');
  });
});
