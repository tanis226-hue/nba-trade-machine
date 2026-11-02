import { describe,it,expect } from 'vitest';
import { SEASON_RULES_2026_27 as rules } from '../constants';
import { evaluate } from '../engine';
import { suggestFixes,planAutoFix } from '../autofix';
import type { TradeInput } from '../types';

const input:TradeInput={season:rules.cap,matching:rules.matching,apron:rules.apron,rules,
  teams:[{abbr:'BOS',preTradeSalary:180_480_000},{abbr:'LAL',preTradeSalary:104_030_000,capSpace:60_931_000}],
  assets:[{id:'tatum',label:'Jayson Tatum',kind:'player',salary:58_456_566,tradeBonusPct:0.15,fromTeam:'BOS',toTeam:'LAL'}],
};
describe('launch regressions',()=>{
  it('uses the same bonus-adjusted cap-room shortfall for findings and suggestions',()=>{
    const finding=evaluate(input).errors.find(f=>f.code==='OVER_MATCH')!;
    expect(finding.matching?.shortfall).toBeCloseTo(6_294_050.9,1);
    expect(finding.fix).toContain('$6.3M');
    expect(suggestFixes(input).find(f=>f.teamAbbr==='LAL')?.text).toContain('$6.3M');
  });
  it('does not offer an automatic fix that just empties the deal',()=>{
    expect(planAutoFix(input)).toEqual([]);
  });
  it('fails closed when a rule throws',()=>{
    const result=evaluate(input,[()=>{throw new Error('test rule failure');}]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('RULE_EVALUATION_FAILED');
  });
});
