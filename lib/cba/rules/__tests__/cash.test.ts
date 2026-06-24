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

  it('falls back to asset.salary when amount is absent', () => {
    const assets = [
      cash({ fromTeam: 'LAL', toTeam: 'BOS', amount: undefined, salary: 9_000_000 }),
    ];
    const teams = [makeTeam({ abbr: 'LAL' }), makeTeam({ abbr: 'BOS' })];
    const findings = cashRule(ctx(assets, teams));
    expect(findings.find((f) => f.teamAbbr === 'LAL')).toBeDefined();
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
});
