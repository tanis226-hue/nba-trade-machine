import { describe, expect, it } from 'vitest';
import { buildContext, evaluate } from '../engine';
import { SEASON_RULES_2026_27 as rules } from '../constants';
import { cashRule } from '../rules/cash';
import { dataQualityRule } from '../rules/dataQuality';
import { hardCapRule } from '../rules/hardCap';
import { taxRule } from '../rules/tax';
import { LEGACY_CASH_USAGE_NOTE } from '../cash';
import type { TradeAsset, TradeInput } from '../types';

const cash: TradeAsset = { id: 'cash', kind: 'cash', label: 'Cash', salary: 0, amount: 1_000_000, fromTeam: 'BOS', toTeam: 'LAL' };
function proposal(assets: TradeAsset[] = [cash], salary = 210_000_000): TradeInput {
  return {
    season: rules.cap, matching: rules.matching, apron: rules.apron, rules,
    simulatedDate: '2026-11-02', assets,
    teams: [{ abbr: 'BOS', preTradeSalary: salary, cashUsage: { season: '2026-27', sent: 0, received: 0 } },
      { abbr: 'LAL', preTradeSalary: 100_000_000, cashUsage: { season: '2026-27', sent: 0, received: 0 } }],
  };
}
const checks = [cashRule, hardCapRule];
const player = (id: string, fromTeam: string, toTeam: string, salary: number, apronSalary = salary): TradeAsset =>
  ({ id, kind: 'player', label: id, fromTeam, toTeam, salary, apronSalary });

describe('cash transaction integration', () => {
  it('derives the second-apron hard cap and blocks cash sending while above it after the deal', () => {
    const result = evaluate(proposal([cash], rules.cap.secondApron + 1), checks);
    expect(result.valid).toBe(false);
    expect(result.perTeam[0].hardCapLine).toBe(rules.cap.secondApron);
    expect(result.errors).toEqual([expect.objectContaining({ code: 'HARD_CAP_EXCEEDED', teamAbbr: 'BOS' })]);
    expect(result.errors[0].message).toContain('by $1.');
    expect(result.errors[0].fix).toContain('at least $1 ');
    expect(result.perTeam[1].hardCapLine).toBeNull();
  });

  it('allows a team above the apron to shed salary and send cash in the same transaction', () => {
    const assets = [cash, player('out', 'BOS', 'LAL', 5_000_000)];
    const result = evaluate(proposal(assets, rules.cap.secondApron + 4_000_000), checks);
    expect(result.valid).toBe(true);
    expect(result.perTeam[0].preTier).toBe('second_apron');
    expect(result.perTeam[0].hardCapLine).toBe(rules.cap.secondApron);
    expect(result.perTeam[0].apronPostSalary).toBe(rules.cap.secondApron - 1_000_000);
  });

  it('allows exact second-apron equality after sending cash', () => {
    const assets = [cash, player('out', 'BOS', 'LAL', 5_000_000)];
    const result = evaluate(proposal(assets, rules.cap.secondApron + 5_000_000), checks);
    expect(result.valid).toBe(true);
    expect(result.perTeam[0].apronPostSalary).toBe(rules.cap.secondApron);
  });

  it('blocks crossing the apron even when pre-trade payroll is below it', () => {
    const assets = [cash, player('out', 'BOS', 'LAL', 10_000_000),
      player('in', 'LAL', 'BOS', 10_000_000, 12_000_000)];
    const result = evaluate(proposal(assets, rules.cap.secondApron - 1_000_000), checks);
    expect(result.perTeam[0].hardCapLine).toBe(rules.cap.secondApron);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'HARD_CAP_EXCEEDED', teamAbbr: 'BOS' }));
  });

  it('preserves a tighter pre-existing first-apron hard cap', () => {
    const input = proposal([cash], 190_000_000);
    input.teams[0].hardCapLine = rules.cap.firstApron;
    expect(evaluate(input, checks).perTeam[0].hardCapLine).toBe(rules.cap.firstApron);
  });

  it('retained cash causes no ledger findings, assumptions, or hard cap', () => {
    const input = proposal([{ ...cash, toTeam: 'BOS', amount: 99_000_000, dataNotes: [LEGACY_CASH_USAGE_NOTE] }]);
    input.teams[0].cashUsage = undefined;
    const result = evaluate(input, [...checks, dataQualityRule]);
    expect(result.findings).toEqual([]);
    expect(result.perTeam[0].hardCapLine).toBeNull();
  });

  it('marks legacy invalid moved cash blocked and never treats its salary or apron salary as payroll', () => {
    const input = proposal([{ ...cash, salary: 40_000_000, apronSalary: 50_000_000, tradeBonusPct: 0.15 }]);
    const context = buildContext(input);
    expect(context.teams[0].outgoing).toBe(0);
    expect(context.teams[0].outgoingMatch).toBe(0);
    expect(context.teams[1].incoming).toBe(0);
    const result = evaluate(input, [...checks, taxRule]);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_CASH_AMOUNT' }));
    expect(result.perTeam[0].postSalary).toBe(210_000_000);
    expect(result.perTeam[0].apronPostSalary).toBe(210_000_000);
    expect(result.perTeam[1].postSalary).toBe(100_000_000);
    const baseline = evaluate(proposal([], 210_000_000), [taxRule]);
    expect(result.findings?.filter((f) => f.code === 'TAX_BILL')).toEqual(baseline.findings);
  });

  it('replaces the stale legacy cash note with direction-specific unknown usage findings', () => {
    const input = proposal([{ ...cash, dataNotes: [LEGACY_CASH_USAGE_NOTE] }], 190_000_000);
    input.teams[0].cashUsage = undefined;
    const result = evaluate(input, [cashRule, dataQualityRule]);
    expect(result.findings).toEqual([expect.objectContaining({ code: 'CASH_USAGE_UNKNOWN', teamAbbr: 'BOS' })]);
  });
});
