import { describe, it, expect } from 'vitest';
import { matchingRule } from '../matching';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '../../constants';
import type { PerTeamContext, RuleContext, TradeAsset, TradeMethod } from '../../types';

function team(p: Partial<PerTeamContext> & { abbr: string }): PerTeamContext {
  return {
    outgoing: 0,
    incoming: 0,
    postSalary: 0,
    preTier: 'over_cap',
    postTier: 'over_cap',
    playersOut: 0,
    preTradeSalary: 0,
    apronSalary: 0,
    exceptions: [],
    outgoingAssets: [],
    incomingAssets: [],
    ...p,
  };
}

function ctx(teams: PerTeamContext[], tradeMethod: TradeMethod = 'simultaneous'): RuleContext {
  return { season: SEASON_2025_26, matching: MATCHING_2025_26, apron: APRON_2025_26, tradeMethod, teams, assets: [] };
}

const player = (salary: number, extra: Partial<TradeAsset> = {}): TradeAsset => ({
  id: `p${salary}`,
  kind: 'player',
  salary,
  fromTeam: 'X',
  toTeam: 'AAA',
  label: `P${salary}`,
  ...extra,
});

describe('matchingRule', () => {
  it('blocks an over-cap pure receiver taking salary with nothing out and no room', () => {
    const t = team({ abbr: 'AAA', incoming: 30_000_000, incomingAssets: [player(30_000_000)] });
    const out = matchingRule(ctx([t]));
    expect(out.some((f) => f.code === 'OVER_MATCH' && f.severity === 'block')).toBe(true);
  });

  it('allows a below-cap team to absorb into cap space (no matching needed)', () => {
    const t = team({
      abbr: 'AAA',
      preTier: 'below_cap',
      capSpace: 40_000_000,
      incoming: 30_000_000,
      incomingAssets: [player(30_000_000)],
    });
    expect(matchingRule(ctx([t]))).toEqual([]);
  });

  it('absorbs a single contract into a TPE without matching', () => {
    const t = team({
      abbr: 'AAA',
      exceptions: [{ kind: 'tpe', amount: 10_000_000 }],
      incoming: 8_000_000,
      incomingAssets: [player(8_000_000)],
    });
    expect(matchingRule(ctx([t]))).toEqual([]);
  });

  it('exempts an incoming minimum contract for an over-cap team', () => {
    const t = team({
      abbr: 'AAA',
      incoming: 2_000_000,
      incomingAssets: [player(2_000_000, { isMinimum: true })],
    });
    expect(matchingRule(ctx([t]))).toEqual([]);
  });

  it('blocks a standard over-match (send 5M, take back 40M)', () => {
    const t = team({ abbr: 'AAA', outgoing: 5_000_000, incoming: 40_000_000, incomingAssets: [player(40_000_000)] });
    expect(matchingRule(ctx([t])).some((f) => f.code === 'OVER_MATCH')).toBe(true);
  });

  it('generates a TPE on a legal non-simultaneous trade', () => {
    const t = team({ abbr: 'AAA', outgoing: 20_000_000, incoming: 12_000_000, incomingAssets: [player(12_000_000)] });
    const out = matchingRule(ctx([t], 'non_simultaneous'));
    expect(out.some((f) => f.code === 'OVER_MATCH')).toBe(false);
    expect(out.some((f) => f.code === 'TPE_GENERATED' && f.severity === 'info')).toBe(true);
  });

  it('folds an unearned trade kicker into the receiving side', () => {
    // base 30M + 15% kicker = 34.5M incoming for a team that sent 30M out (limit 125%+$250k = 37.75M) → legal,
    // but bump the kicker target over the limit to force a block.
    const t = team({
      abbr: 'AAA',
      outgoing: 5_000_000,
      incoming: 10_000_000,
      incomingAssets: [player(10_000_000, { tradeBonusPct: 0.15 })], // 11.5M effective
    });
    // limit for 5M out = 5*2+0.25 = 10.25M; effective incoming 11.5M > limit → block
    expect(matchingRule(ctx([t])).some((f) => f.code === 'OVER_MATCH')).toBe(true);
  });
});
