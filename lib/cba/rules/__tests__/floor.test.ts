import { describe, it, expect } from 'vitest';
import { floorRule } from '../floor';
import type { PerTeamContext, RuleContext, SeasonCap } from '../../types';

function makeTeam(partial: Partial<PerTeamContext> & { abbr: string }): PerTeamContext {
  return {
    outgoing: partial.outgoing ?? 0,
    incoming: partial.incoming ?? 0,
    postSalary: partial.postSalary ?? 0,
    preTier: partial.preTier ?? 'below_cap',
    postTier: partial.postTier ?? 'below_cap',
    playersOut: partial.playersOut ?? 0,
    preTradeSalary: partial.preTradeSalary ?? 0,
    apronSalary: partial.apronSalary ?? 0,
    exceptions: partial.exceptions ?? [],
    outgoingAssets: partial.outgoingAssets ?? [],
    incomingAssets: partial.incomingAssets ?? [],
    ...partial,
  };
}

const season: SeasonCap = {
  season: '2024-25',
  salaryCap: 140_588_000,
  taxLine: 170_814_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
  minTeamSalary: 126_529_200, // 90% of cap
};

function ctx(teams: PerTeamContext[], cap: SeasonCap = season): RuleContext {
  return {
    season: cap,
    matching: {} as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams,
    assets: [],
  };
}

describe('floorRule', () => {
  it('warns when a team falls below the minimum team salary', () => {
    const out = floorRule(ctx([makeTeam({ abbr: 'UTA', postSalary: 110_000_000 })]));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('MIN_TEAM_SALARY');
    expect(out[0].severity).toBe('warning');
    expect(out[0].teamAbbr).toBe('UTA');
    expect(out[0].citation).toContain('Art. VII');
  });

  it('returns no findings when every team is at or above the floor (negative case)', () => {
    const out = floorRule(
      ctx([
        makeTeam({ abbr: 'BOS', postSalary: 188_000_000 }),
        makeTeam({ abbr: 'LAL', postSalary: 126_529_200 }), // exactly at floor
      ]),
    );
    expect(out).toEqual([]);
  });

  it('no-ops when no floor value is available', () => {
    const noFloor: SeasonCap = { ...season, minTeamSalary: undefined };
    const out = floorRule(ctx([makeTeam({ abbr: 'DET', postSalary: 50_000_000 })], noFloor));
    expect(out).toEqual([]);
  });

  it('flags only the teams below the floor in a multi-team trade', () => {
    const out = floorRule(
      ctx([
        makeTeam({ abbr: 'OKC', postSalary: 100_000_000 }),
        makeTeam({ abbr: 'DEN', postSalary: 180_000_000 }),
        makeTeam({ abbr: 'SAS', postSalary: 120_000_000 }),
      ]),
    );
    expect(out.map((f) => f.teamAbbr)).toEqual(['OKC', 'SAS']);
  });

  it('falls back to ctx.rules.cap.minTeamSalary when season.minTeamSalary is absent', () => {
    const noFloorSeason: SeasonCap = { ...season, minTeamSalary: undefined };
    const c = ctx([makeTeam({ abbr: 'POR', postSalary: 100_000_000 })], noFloorSeason);
    c.rules = { cap: { ...season }, matching: {} as any, apron: {} as any };
    const out = floorRule(c);
    expect(out).toHaveLength(1);
    expect(out[0].teamAbbr).toBe('POR');
  });
});
