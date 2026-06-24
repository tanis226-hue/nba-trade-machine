import { describe, it, expect } from 'vitest';
import { gradeTrade, assetValue, assetSurplus } from '../grade';
import type { TradeAsset, TradeTeamInput } from '../types';

const teams: TradeTeamInput[] = [
  { abbr: 'AAA', preTradeSalary: 0 },
  { abbr: 'BBB', preTradeSalary: 0 },
];

const player = (id: string, from: string, to: string, value: number): TradeAsset => ({
  id, kind: 'player', salary: 0, fromTeam: from, toTeam: to, label: id, value,
});

describe('gradeTrade', () => {
  it('rates a balanced star-for-star swap as even', () => {
    const r = gradeTrade(teams, [player('a', 'AAA', 'BBB', 22), player('b', 'BBB', 'AAA', 21)]);
    expect(r.spread).toBeLessThanOrEqual(3);
    expect(r.favored).toBeUndefined();
    expect(r.verdict).toMatch(/even/i);
  });

  it('flags the team that gains the most value in a lopsided deal', () => {
    const r = gradeTrade(teams, [player('star', 'BBB', 'AAA', 25), player('scrub', 'AAA', 'BBB', 6)]);
    expect(r.favored).toBe('AAA');
    expect(r.spread).toBeGreaterThan(3);
    const aaa = r.teams.find((t) => t.abbr === 'AAA')!;
    expect(aaa.net).toBeGreaterThan(0);
  });

  it('values draft picks and ignores stay assets', () => {
    const pick: TradeAsset = { id: 'pk', kind: 'pick', salary: 0, fromTeam: 'AAA', toTeam: 'BBB', label: '2026 1st', round: 1, pickYear: 2026 };
    const stay = player('stay', 'AAA', 'AAA', 30); // not moving — must be ignored
    const r = gradeTrade(teams, [pick, stay]);
    expect(assetValue(pick)).toBeGreaterThan(0);
    const bbb = r.teams.find((t) => t.abbr === 'BBB')!;
    expect(bbb.inValue).toBe(assetValue(pick));
    const aaa = r.teams.find((t) => t.abbr === 'AAA')!;
    expect(aaa.outValue).toBe(assetValue(pick)); // only the pick, not the stay player
  });

  it('rewards cheap production in the surplus dimension', () => {
    const cheapStar: TradeAsset = { id: 'c', kind: 'player', salary: 5_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'c', value: 18 };
    const pricyStar: TradeAsset = { id: 'p', kind: 'player', salary: 50_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'p', value: 18 };
    // equal talent (18 each) → talent net ~0, but AAA takes the cheap deal → positive cap value
    expect(assetSurplus(cheapStar)).toBeGreaterThan(assetSurplus(pricyStar));
    const r = gradeTrade(teams, [cheapStar, pricyStar]);
    const aaa = r.teams.find((t) => t.abbr === 'AAA')!;
    expect(Math.abs(aaa.net)).toBeLessThanOrEqual(3); // talent is even
    expect(aaa.surplusNet).toBeGreaterThan(0); // but AAA wins on contract value
  });

  it('reports no movement for an empty deal', () => {
    const r = gradeTrade(teams, []);
    expect(r.verdict).toMatch(/no players or picks/i);
  });
});
