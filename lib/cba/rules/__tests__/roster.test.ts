import { describe, it, expect } from 'vitest';
import { rosterRule } from '../roster';
import type { RuleContext, PerTeamContext, TradeAsset } from '../../types';

function player(partial: Partial<TradeAsset>): TradeAsset {
  return {
    id: partial.id ?? 'p',
    kind: 'player',
    salary: partial.salary ?? 10_000_000,
    fromTeam: partial.fromTeam ?? 'AAA',
    toTeam: partial.toTeam ?? 'BBB',
    label: partial.label ?? 'Player',
    ...partial,
  };
}

function makeTeam(partial: Partial<PerTeamContext>): PerTeamContext {
  const incomingAssets = partial.incomingAssets ?? [];
  const outgoingAssets = partial.outgoingAssets ?? [];
  return {
    abbr: partial.abbr ?? 'AAA',
    outgoing: partial.outgoing ?? outgoingAssets.reduce((s, a) => s + a.salary, 0),
    incoming: partial.incoming ?? incomingAssets.reduce((s, a) => s + a.salary, 0),
    postSalary: partial.postSalary ?? 100_000_000,
    preTier: partial.preTier ?? 'over_cap',
    postTier: partial.postTier ?? 'over_cap',
    playersOut: partial.playersOut ?? outgoingAssets.filter((a) => a.kind === 'player').length,
    preTradeSalary: partial.preTradeSalary ?? 100_000_000,
    apronSalary: partial.apronSalary ?? 100_000_000,
    exceptions: partial.exceptions ?? [],
    rosterCount: partial.rosterCount,
    outgoingAssets,
    incomingAssets,
  };
}

function ctxFor(teams: PerTeamContext[]): RuleContext {
  return {
    season: { season: '2024-25', salaryCap: 140_588_000, taxLine: 170_814_000, firstApron: 178_132_000, secondApron: 188_931_000 },
    matching: {} as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams,
    assets: teams.flatMap((t) => [...t.incomingAssets, ...t.outgoingAssets]),
  };
}

describe('rosterRule', () => {
  it('blocks when post-trade standard roster exceeds 15', () => {
    const team = makeTeam({
      abbr: 'BOS',
      rosterCount: 15,
      incomingAssets: [player({ id: 'in1' }), player({ id: 'in2' })],
      outgoingAssets: [player({ id: 'out1' })],
    });
    const findings = rosterRule(ctxFor([team]));
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('ROSTER_OVER');
    expect(findings[0].severity).toBe('block');
    expect(findings[0].fix).toBeTruthy();
    expect(findings[0].citation).toBeTruthy();
  });

  it('warns when post-trade standard roster falls below 14', () => {
    const team = makeTeam({
      abbr: 'LAL',
      rosterCount: 14,
      outgoingAssets: [player({ id: 'out1' }), player({ id: 'out2' })],
    });
    const findings = rosterRule(ctxFor([team]));
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('ROSTER_UNDER');
    expect(findings[0].severity).toBe('warning');
  });

  it('ignores two-way players in the standard-roster count', () => {
    const team = makeTeam({
      abbr: 'NYK',
      rosterCount: 15,
      incomingAssets: [player({ id: 'tw', isTwoWay: true }), player({ id: 'tw2', isTwoWay: true })],
      outgoingAssets: [player({ id: 'out1' })],
    });
    // net standard = 0 incoming (both two-way) - 1 outgoing = -1 → 14, legal
    const findings = rosterRule(ctxFor([team]));
    expect(findings).toHaveLength(0);
  });

  it('no-ops when rosterCount is undefined', () => {
    const team = makeTeam({
      abbr: 'MIA',
      rosterCount: undefined,
      incomingAssets: [player({ id: 'in1' }), player({ id: 'in2' }), player({ id: 'in3' })],
    });
    expect(rosterRule(ctxFor([team]))).toEqual([]);
  });

  it('returns [] for a clean 1-for-1 swap (negative case)', () => {
    const team = makeTeam({
      abbr: 'DEN',
      rosterCount: 15,
      incomingAssets: [player({ id: 'in1' })],
      outgoingAssets: [player({ id: 'out1' })],
    });
    expect(rosterRule(ctxFor([team]))).toEqual([]);
  });
});
