import { describe, it, expect } from 'vitest';
import { suggestFixes } from '../autofix';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26, SEASON_RULES_2025_26 } from '../constants';
import type { TradeInput } from '../types';

const base = { season: SEASON_2025_26, matching: MATCHING_2025_26, apron: APRON_2025_26, rules: SEASON_RULES_2025_26 };

describe('suggestFixes', () => {
  it('returns nothing for a legal trade', () => {
    const input: TradeInput = {
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 160_000_000 },
        { abbr: 'BBB', preTradeSalary: 160_000_000 },
      ],
      assets: [
        { id: 'a', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A' },
        { id: 'b', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B' },
      ],
    };
    expect(suggestFixes(input)).toEqual([]);
  });

  it('quantifies the over-match shortfall', () => {
    const input: TradeInput = {
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 160_000_000 },
        { abbr: 'BBB', preTradeSalary: 160_000_000 },
      ],
      assets: [
        { id: 'a', kind: 'player', salary: 5_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A' },
        { id: 'b', kind: 'player', salary: 40_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B' },
      ],
    };
    const fixes = suggestFixes(input);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes.some((f) => f.teamAbbr === 'AAA' && /send .* more out|take back/.test(f.text))).toBe(true);
  });

  it('suggests de-aggregation for a second-apron team', () => {
    const input: TradeInput = {
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 215_000_000 }, // over second apron
        { abbr: 'BBB', preTradeSalary: 160_000_000 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        { id: 'a2', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
        { id: 'b', kind: 'player', salary: 39_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B' },
      ],
    };
    const fixes = suggestFixes(input);
    expect(fixes.some((f) => f.teamAbbr === 'AAA' && /one player/i.test(f.text))).toBe(true);
  });
});
