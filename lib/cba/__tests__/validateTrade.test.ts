import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/lib/cba/validateTrade';
import { season, matching, apron } from './fixtures';
import type { TradeInput } from '@/lib/cba/types';

const base = { season, matching, apron };

describe('validateTrade', () => {
  it('legal even swap between two over-cap teams is valid', () => {
    const input: TradeInput = {
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 120 },
        { abbr: 'BBB', preTradeSalary: 120 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'Player A' },
        { id: 'b1', kind: 'player', salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'Player B' },
      ],
    };
    const r = validateTrade(input);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    const aaa = r.perTeam.find((t) => t.abbr === 'AAA')!;
    expect(aaa.outgoing).toBe(20);
    expect(aaa.incoming).toBe(20);
    expect(aaa.postSalary).toBe(120);
  });

  it('second-apron team sending 2 players => aggregation error', () => {
    const r = validateTrade({
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 165 },
        { abbr: 'BBB', preTradeSalary: 120 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        { id: 'a2', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
        { id: 'b1', kind: 'player', salary: 39, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      ],
    });
    expect(r.errors.some((e) => e.code === 'NO_AGGREGATION' && e.teamAbbr === 'AAA')).toBe(true);
  });

  it('over-cap team taking back too much => match error', () => {
    // AAA sends 5 (tier1) => max incoming 5*2+1 = 11; takes back 40 => error
    const r = validateTrade({
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 120 },
        { abbr: 'BBB', preTradeSalary: 120 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 5, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        { id: 'b1', kind: 'player', salary: 40, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      ],
    });
    expect(r.errors.some((e) => e.code === 'OVER_MATCH' && e.teamAbbr === 'AAA')).toBe(true);
  });

  it('first-apron team sending 2 players can aggregate (no phantom 2nd-apron block)', () => {
    const r = validateTrade({
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 152 },
        { abbr: 'BBB', preTradeSalary: 120 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 10, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        { id: 'a2', kind: 'player', salary: 5, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
        { id: 'b1', kind: 'player', salary: 15, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      ],
    });
    expect(r.errors.some((e) => e.code === 'NO_AGGREGATION')).toBe(false);
  });

  it('picks do not count toward aggregation or salary', () => {
    const r = validateTrade({
      ...base,
      teams: [
        { abbr: 'AAA', preTradeSalary: 165 },
        { abbr: 'BBB', preTradeSalary: 120 },
      ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        { id: 'pk', kind: 'pick', salary: 0, fromTeam: 'AAA', toTeam: 'BBB', label: '2027 1st' },
        { id: 'b1', kind: 'player', salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      ],
    });
    expect(r.errors.some((e) => e.code === 'NO_AGGREGATION')).toBe(false);
  });
});
