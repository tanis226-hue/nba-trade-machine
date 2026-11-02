import { describe, it, expect } from 'vitest';
import { cashRule } from '../cash';
import type {
  PerTeamContext,
  RuleContext,
  TradeAsset,
  SeasonCap,
  MatchingRules,
  ApronRules,
} from '../../types';

function makeTeam(partial: Partial<PerTeamContext> & { abbr: string }): PerTeamContext {
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
    cashUsage: { season: '2025-26', sent: 0, received: 0 },
    ...partial,
  };
}

function cash(partial: Partial<TradeAsset> & { fromTeam: string; toTeam: string }): TradeAsset {
  return {
    id: partial.id ?? `cash-${partial.fromTeam}-${partial.toTeam}`,
    kind: 'cash',
    salary: 0,
    label: 'Cash',
    ...partial,
  };
}

const season: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_647_000,
  taxLine: 187_895_000,
  firstApron: 195_945_000,
  secondApron: 207_824_000,
};
const matching = {} as MatchingRules;
const apron = {} as ApronRules;

function ctx(assets: TradeAsset[], teams: PerTeamContext[], cashLimit?: number): RuleContext {
  return {
    season,
    matching,
    apron,
    rules: cashLimit !== undefined ? ({ cashLimit } as any) : undefined,
    tradeMethod: 'simultaneous',
    teams,
    assets,
  };
}

describe('cashRule', () => {
  it('blocks when a team sends more cash than the limit', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 9_000_000 })];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams));

    const sent = findings.find((f) => f.teamAbbr === 'LAL');
    expect(sent).toBeDefined();
    expect(sent!.code).toBe('CASH_OVER_LIMIT');
    expect(sent!.severity).toBe('block');
    expect(sent!.citation).toBeTruthy();
    expect(sent!.fix).toBeTruthy();
    expect(sent!.message).toMatch(/sending/);
  });

  it('blocks the receiving team independently when received cash exceeds the limit', () => {
    // Two senders each under the limit, but one receiver aggregates over the limit.
    const assets = [
      cash({ id: 'c1', fromTeam: 'LAL', toTeam: 'BOS', amount: 5_000_000 }),
      cash({ id: 'c2', fromTeam: 'MIA', toTeam: 'BOS', amount: 5_000_000 }),
    ];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'MIA' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams));

    expect(findings.filter((f) => f.teamAbbr === 'LAL')).toHaveLength(0);
    expect(findings.filter((f) => f.teamAbbr === 'MIA')).toHaveLength(0);
    const received = findings.find((f) => f.teamAbbr === 'BOS');
    expect(received).toBeDefined();
    expect(received!.message).toMatch(/receiving/);
    expect(received!.code).toBe('CASH_OVER_LIMIT');
  });

  it('respects a custom cashLimit from ctx.rules', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 8_000_000 })];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams, 8_500_000));
    expect(findings).toHaveLength(0);
  });

  it('rejects legacy matching-salary cash instead of using it as an amount', () => {
    const assets = [
      cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: undefined, salary: 9_000_000 }),
    ];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams));
    expect(findings.find((f) => f.code === 'INVALID_CASH_AMOUNT')).toBeDefined();
  });

  it('returns [] (negative case) when cash is within the limit', () => {
    const assets = [
      cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 4_000_000 }),
      cash({ id: 'back', fromTeam: 'BOS', toTeam: 'LAL', amount: 3_000_000 }),
    ];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    expect(cashRule(ctx(assets, teams))).toEqual([]);
  });

  it('ignores non-cash assets entirely', () => {
    const assets: TradeAsset[] = [
      { id: 'p1', kind: 'player', salary: 30_000_000, fromTeam: 'LAL', toTeam: 'BOS', label: 'Star' },
    ];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    expect(cashRule(ctx(assets, teams))).toEqual([]);
  });

  it('ignores retained cash, even if its draft amount is missing or over the limit', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'LAL', amount: 99_000_000 }),
      cash({ id: 'draft', fromTeam: 'BOS', toTeam: 'BOS' })];
    expect(cashRule(ctx(assets, [makeTeam({ abbr: 'LAL', cashUsage: undefined }), makeTeam({ abbr: 'BOS' })]))).toEqual([]);
  });

  it('checks prior sent and received independently without netting a multi-team pass-through', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 2 }),
      cash({ fromTeam: 'MIA', toTeam: 'LAL', amount: 2 })];
    const teams = [makeTeam({ abbr: 'LAL', cashUsage: { season: '2025-26', sent: 9, received: 1 } }),
      makeTeam({ abbr: 'BOS' }), makeTeam({ abbr: 'MIA' })];
    const findings = cashRule(ctx(assets, teams, 10));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'CASH_OVER_LIMIT', teamAbbr: 'LAL', severity: 'block' });
    expect(findings[0].message).toContain('by $1.');
    expect(findings[0].fix).toContain('$1 or less');
  });

  it('allows an exact gross allowance and blocks the next whole dollar', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 3 })];
    const teams = [makeTeam({ abbr: 'LAL', cashUsage: { season: '2025-26', sent: 7 } }),
      makeTeam({ abbr: 'BOS' })];
    expect(cashRule(ctx(assets, teams, 10))).toEqual([]);
    assets[0].amount = 4;
    expect(cashRule(ctx(assets, teams, 10))[0].message).toContain('by $1.');
  });

  it('retains fractional formula limits while suggesting a whole-dollar maximum', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 11 })];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams, 10.5));
    expect(findings[0].message).toContain('$10.50');
    expect(findings[0].message).toContain('$0.50');
    expect(findings[0].fix).toContain('$10 or less');
  });

  it('marks each missing or wrong-season direction unknown rather than zero', () => {
    const assets = [cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 1 }),
      cash({ fromTeam: 'BOS', toTeam: 'LAL', amount: 1 })];
    const teams = [makeTeam({ abbr: 'LAL', cashUsage: { season: '2025-26', sent: 0 } }),
      makeTeam({ abbr: 'BOS', cashUsage: { season: '2024-25', sent: 0, received: 0 } })];
    const findings = cashRule(ctx(assets, teams, 10));
    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.code === 'CASH_USAGE_UNKNOWN' && f.severity === 'conditional')).toBe(true);
    expect(findings.find((f) => f.teamAbbr === 'LAL')?.message).toContain('prior cash received');
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity])('blocks malformed moved cash amount %s', (amount) => {
    const findings = cashRule(ctx([cash({ fromTeam: 'LAL', toTeam: 'BOS', amount })], [makeTeam({ abbr: 'LAL' })]));
    expect(findings).toEqual([expect.objectContaining({ code: 'INVALID_CASH_AMOUNT', severity: 'block' })]);
  });

  it.each([-1, 0.5, NaN, Infinity])('blocks malformed prior usage %s rather than offsetting the deal', (sent) => {
    const findings = cashRule(ctx([cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 1 })],
      [makeTeam({ abbr: 'LAL', cashUsage: { season: '2025-26', sent } })]));
    expect(findings[0].code).toBe('INVALID_CASH_USAGE');
  });

  it('makes a date outside the selected cap year conditional', () => {
    const context = ctx([cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 1 })], [makeTeam({ abbr: 'LAL' })]);
    context.simulatedDate = '2026-07-01';
    expect(cashRule(context)).toContainEqual(expect.objectContaining({ code: 'CASH_CAP_YEAR_MISMATCH', severity: 'conditional' }));
  });

  it('warns only senders during the post-regular-season window about unmodeled next-year apron rules', () => {
    const context = ctx([cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: 1 })],
      [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })]);
    context.rules = { calendar: { regularSeasonEnd: '2026-04-12' } } as RuleContext['rules'];
    for (const date of ['2026-04-13', '2026-06-30']) {
      context.simulatedDate = date;
      expect(cashRule(context).filter((f) => f.code === 'CASH_NEXT_SEASON_APRON_UNKNOWN'))
        .toEqual([expect.objectContaining({ teamAbbr: 'LAL', severity: 'conditional' })]);
    }
    for (const date of ['2026-04-12', '2025-07-01', '2026-07-01']) {
      context.simulatedDate = date;
      expect(cashRule(context).some((f) => f.code === 'CASH_NEXT_SEASON_APRON_UNKNOWN')).toBe(false);
    }
  });
});
