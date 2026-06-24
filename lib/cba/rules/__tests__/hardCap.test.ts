import { describe, it, expect } from 'vitest';
import { hardCapRule } from '../hardCap';
import type { PerTeamContext, RuleContext, SeasonCap, TradeAsset } from '../../types';

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

function player(partial: Partial<TradeAsset> & { id: string; salary: number }): TradeAsset {
  return {
    kind: partial.kind ?? 'player',
    fromTeam: partial.fromTeam ?? 'X',
    toTeam: partial.toTeam ?? 'Y',
    label: partial.label ?? partial.id,
    ...partial,
  };
}

const season: SeasonCap = {
  season: '2024-25',
  salaryCap: 140_588_000,
  taxLine: 170_814_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
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

describe('hardCapRule', () => {
  it('blocks when post-trade apron salary exceeds an existing hardCapLine', () => {
    const team = makeTeam({
      abbr: 'PHX',
      apronSalary: 175_000_000,
      hardCapLine: 178_132_000,
      incomingAssets: [player({ id: 'in', salary: 10_000_000 })],
      outgoingAssets: [player({ id: 'out', salary: 4_000_000 })],
    });
    // post = 175M - 4M + 10M = 181M > 178.132M
    const out = hardCapRule(ctx([team]));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('HARD_CAP_EXCEEDED');
    expect(out[0].severity).toBe('block');
    expect(out[0].teamAbbr).toBe('PHX');
    expect(out[0].citation).toContain('2023 CBA');
    expect(out[0].fix).toBeTruthy();
  });

  it('blocks at the first apron when a team acquires a sign-and-trade player', () => {
    const team = makeTeam({
      abbr: 'LAL',
      apronSalary: 174_000_000,
      incomingAssets: [
        player({ id: 'sat', salary: 8_000_000, signedVia: 'sign_and_trade' }),
      ],
      outgoingAssets: [player({ id: 'out', salary: 1_000_000 })],
    });
    // post = 174M - 1M + 8M = 181M > firstApron 178.132M
    const out = hardCapRule(ctx([team]));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('HARD_CAP_ST');
    expect(out[0].severity).toBe('block');
    expect(out[0].teamAbbr).toBe('LAL');
    expect(out[0].citation).toContain('sign-and-trade');
    expect(out[0].fix).toBeTruthy();
  });

  it('returns no findings when under both lines (negative case)', () => {
    const team = makeTeam({
      abbr: 'BOS',
      apronSalary: 160_000_000,
      hardCapLine: 178_132_000,
      incomingAssets: [
        player({ id: 'in', salary: 5_000_000, signedVia: 'sign_and_trade' }),
      ],
      outgoingAssets: [player({ id: 'out', salary: 6_000_000 })],
    });
    // post = 160M - 6M + 5M = 159M, below firstApron and hardCapLine
    const out = hardCapRule(ctx([team]));
    expect(out).toEqual([]);
  });

  it('uses apronSalary on assets when present rather than cap hit', () => {
    const team = makeTeam({
      abbr: 'MIA',
      apronSalary: 177_000_000,
      hardCapLine: 178_132_000,
      // cap hit 1M would keep it under, but apron-basis hit 3M pushes it over
      incomingAssets: [player({ id: 'in', salary: 1_000_000, apronSalary: 3_000_000 })],
      outgoingAssets: [],
    });
    // post = 177M + 3M = 180M > 178.132M
    const out = hardCapRule(ctx([team]));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('HARD_CAP_EXCEEDED');
  });

  it('no-ops gracefully when no hardCapLine and no sign-and-trade asset', () => {
    const team = makeTeam({
      abbr: 'OKC',
      apronSalary: 200_000_000, // way over, but nothing triggers a hard cap
      incomingAssets: [player({ id: 'in', salary: 20_000_000 })],
      outgoingAssets: [player({ id: 'out', salary: 5_000_000 })],
    });
    const out = hardCapRule(ctx([team]));
    expect(out).toEqual([]);
  });

  it('flags only the offending team in a multi-team trade', () => {
    const over = makeTeam({
      abbr: 'PHI',
      apronSalary: 176_000_000,
      hardCapLine: 178_132_000,
      incomingAssets: [player({ id: 'a', salary: 6_000_000 })],
      outgoingAssets: [],
    });
    const fine = makeTeam({
      abbr: 'BKN',
      apronSalary: 150_000_000,
      hardCapLine: 178_132_000,
      incomingAssets: [player({ id: 'b', salary: 6_000_000 })],
      outgoingAssets: [],
    });
    const out = hardCapRule(ctx([over, fine]));
    expect(out.map((f) => f.teamAbbr)).toEqual(['PHI']);
  });
});
