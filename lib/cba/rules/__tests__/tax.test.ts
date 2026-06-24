import { describe, it, expect } from 'vitest';
import { taxRule } from '../tax';
import type {
  RuleContext,
  PerTeamContext,
  SeasonCap,
  SeasonRules,
  TaxBracket,
} from '../../types';

const season: SeasonCap = {
  season: '2024-25',
  salaryCap: 140_000_000,
  taxLine: 170_000_000,
  firstApron: 178_000_000,
  secondApron: 189_000_000,
};

// Simple two-bracket schedule for arithmetic that is easy to verify:
//  - first $10M over the line: 1.5x standard / 3.0x repeater
//  - everything beyond:        2.0x standard / 4.0x repeater
const taxBrackets: TaxBracket[] = [
  { upTo: 10_000_000, rate: 1.5, repeaterRate: 3.0 },
  { upTo: Infinity, rate: 2.0, repeaterRate: 4.0 },
];

function makeTeam(partial: Partial<PerTeamContext>): PerTeamContext {
  return {
    abbr: 'XXX',
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

function makeCtx(
  teams: PerTeamContext[],
  rules?: Partial<SeasonRules>,
): RuleContext {
  const fullRules: SeasonRules | undefined = rules
    ? ({ cap: season, matching: {}, apron: {}, ...rules } as SeasonRules)
    : undefined;
  return {
    season,
    matching: {} as any,
    apron: {} as any,
    rules: fullRules,
    tradeMethod: 'simultaneous',
    teams,
    assets: [],
  };
}

describe('taxRule', () => {
  it('emits a TAX_BILL info finding using standard rates', () => {
    // $15M over the line: 10M*1.5 + 5M*2.0 = 15M + 10M = $25M
    const team = makeTeam({ abbr: 'LAL', postSalary: 185_000_000 });
    const out = taxRule(makeCtx([team], { taxBrackets }));

    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('TAX_BILL');
    expect(out[0].severity).toBe('info');
    expect(out[0].teamAbbr).toBe('LAL');
    expect(out[0].citation).toContain('Art. VII');
    expect(out[0].message).toContain('$25.0M');
    expect(out[0].message).not.toContain('repeater');
  });

  it('uses repeater rates and labels the finding when isRepeaterTaxpayer', () => {
    // $15M over: 10M*3.0 + 5M*4.0 = 30M + 20M = $50M
    const team = makeTeam({
      abbr: 'GSW',
      postSalary: 185_000_000,
      isRepeaterTaxpayer: true,
    });
    const out = taxRule(makeCtx([team], { taxBrackets }));

    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('$50.0M');
    expect(out[0].message).toContain('(repeater)');
  });

  it('only reports teams above the tax line', () => {
    const over = makeTeam({ abbr: 'BOS', postSalary: 175_000_000 }); // $5M over → 5M*1.5 = 7.5M
    const under = makeTeam({ abbr: 'SAS', postSalary: 160_000_000 }); // below the line
    const exact = makeTeam({ abbr: 'ORL', postSalary: 170_000_000 }); // exactly on the line → no bill
    const out = taxRule(makeCtx([over, under, exact], { taxBrackets }));

    expect(out).toHaveLength(1);
    expect(out[0].teamAbbr).toBe('BOS');
    expect(out[0].message).toContain('$7.5M');
  });

  it('NEGATIVE: returns [] when no taxBrackets are configured', () => {
    const team = makeTeam({ abbr: 'LAL', postSalary: 185_000_000 });
    expect(taxRule(makeCtx([team], {}))).toEqual([]);
    expect(taxRule(makeCtx([team]))).toEqual([]);
  });
});
