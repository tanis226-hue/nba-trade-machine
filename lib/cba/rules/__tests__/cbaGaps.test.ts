import { describe, it, expect } from 'vitest';
import { rosterRule } from '../roster';
import { signAndTradeRule } from '../signAndTrade';
import { eligibilityRule } from '../eligibility';
import { toolsRule } from '../tools';
import { picksRule } from '../picks';
import { matchingRule } from '../matching';
import { picksRule as _picks } from '../picks';
import { buildContext, evaluate } from '../../engine';
import { planAutoFix } from '../../autofix';
import { waiveAndStretch, setOff } from '../../stretch';
import { SEASON_2026_27, MATCHING_2026_27, APRON_2026_27, SEASON_RULES_2026_27 } from '../../constants';
import type { PerTeamContext, RuleContext, TradeAsset, TradeInput } from '../../types';

function team(p: Partial<PerTeamContext>): PerTeamContext {
  return {
    abbr: 'XXX', outgoing: 0, incoming: 0, postSalary: 0, preTier: 'over_cap', postTier: 'over_cap',
    playersOut: 0, preTradeSalary: 0, apronSalary: 0, exceptions: [], outgoingAssets: [], incomingAssets: [],
    ...p,
  };
}
function ctx(teams: PerTeamContext[], extra: Partial<RuleContext> = {}): RuleContext {
  return {
    season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27,
    rules: SEASON_RULES_2026_27, tradeMethod: 'simultaneous', teams, assets: teams.flatMap((t) => [...t.outgoingAssets, ...t.incomingAssets]), ...extra,
  };
}
const player = (p: Partial<TradeAsset>): TradeAsset => ({ id: 'p', kind: 'player', salary: 10_000_000, fromTeam: 'XXX', toTeam: 'YYY', label: 'P', ...p });

describe('roster two-way cap', () => {
  it('blocks TWO_WAY_OVER above 3 two-ways', () => {
    const incoming = [player({ id: 'a', isTwoWay: true }), player({ id: 'b', isTwoWay: true })];
    const t = team({ abbr: 'BOS', incoming: 1, twoWayCount: 2, incomingAssets: incoming });
    const f = rosterRule(ctx([t]));
    expect(f.map((x) => x.code)).toContain('TWO_WAY_OVER');
  });
  it('no TWO_WAY_OVER when twoWayCount is unknown', () => {
    const t = team({ abbr: 'BOS', incoming: 1, incomingAssets: [player({ isTwoWay: true })] });
    expect(rosterRule(ctx([t])).map((x) => x.code)).not.toContain('TWO_WAY_OVER');
  });
});

describe('sign-and-trade term', () => {
  it('blocks ST_LONG_TERM beyond 4 years', () => {
    const a = player({ signedVia: 'sign_and_trade', futureSalaries: [{ season: '27-28', salary: 1 }, { season: '28-29', salary: 1 }, { season: '29-30', salary: 1 }, { season: '30-31', salary: 1 }] }); // 5 yrs
    const t = team({ abbr: 'MIA', preTier: 'over_cap', incoming: 1, incomingAssets: [a] });
    expect(signAndTradeRule(ctx([t])).map((x) => x.code)).toContain('ST_LONG_TERM');
  });
});

describe('trade-deadline gate', () => {
  it('blocks an in-season post-deadline simulated date', () => {
    const t = team({ abbr: 'LAL', outgoing: 1, outgoingAssets: [player({})] });
    const f = eligibilityRule(ctx([t], { simulatedDate: '2027-03-01' })); // after 2027-02-04 deadline, before June
    expect(f.map((x) => x.code)).toContain('TRADE_DEADLINE');
  });
  it('does NOT block an offseason simulated date', () => {
    const t = team({ abbr: 'LAL', outgoing: 1, outgoingAssets: [player({})] });
    const f = eligibilityRule(ctx([t], { simulatedDate: '2026-06-24' }));
    expect(f.map((x) => x.code)).not.toContain('TRADE_DEADLINE');
  });
});

describe('apron tool blocks', () => {
  it('blocks a first-apron team using the Non-Taxpayer MLE', () => {
    const t = team({ abbr: 'DEN', preTier: 'first_apron', toolsUsed: ['non_taxpayer_mle'] });
    expect(toolsRule(ctx([t])).map((x) => x.code)).toContain('TOOL_BLOCKED');
  });
  it('allows tools for a below-apron team', () => {
    const t = team({ abbr: 'DEN', preTier: 'over_cap', toolsUsed: ['non_taxpayer_mle'] });
    expect(toolsRule(ctx([t]))).toEqual([]);
  });
});

describe('hard-cap derivation (expanded take-back)', () => {
  it('hard-caps an over-cap team that takes back more than it sends and ends over the first apron', () => {
    const fa = SEASON_2026_27.firstApron;
    const input: TradeInput = {
      season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27, rules: SEASON_RULES_2026_27,
      teams: [
        { abbr: 'AAA', preTradeSalary: fa - 2_000_000 }, // just under the first apron, over the cap
        { abbr: 'BBB', preTradeSalary: 100_000_000 },
      ],
      assets: [
        { id: 'out', kind: 'player', salary: 5_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'Out' },
        { id: 'in', kind: 'player', salary: 9_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'In' }, // takes back MORE
      ],
    };
    const c = buildContext(input);
    const aaa = c.teams.find((t) => t.abbr === 'AAA')!;
    expect(aaa.hardCapLine).toBe(fa); // expanded take-back hard-caps at the first apron
    expect(aaa.postSalary).toBeGreaterThan(fa); // and the post salary now exceeds it
  });
});

describe('poison pill (rookie-scale extension)', () => {
  it('matches the ACQUIRING team against the extension average, not the current cap hit', () => {
    const input: TradeInput = {
      season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27, rules: SEASON_RULES_2026_27,
      teams: [{ abbr: 'AAA', preTradeSalary: 180_000_000 }, { abbr: 'BBB', preTradeSalary: 180_000_000 }],
      assets: [
        { id: 'send', kind: 'player', salary: 6_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'Filler' },
        // current $5M but the extension averages ~$22M → AAA must match against ~$22M, not $5M.
        { id: 'pp', kind: 'player', salary: 5_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'PoisonPill', isRookieScaleExtension: true, futureSalaries: [{ season: '27-28', salary: 25_000_000 }, { season: '28-29', salary: 28_000_000 }, { season: '29-30', salary: 31_000_000 }] },
      ],
    };
    expect((evaluate(input).findings ?? []).map((f) => f.code)).toContain('OVER_MATCH');
  });
});

describe('TPE expiry', () => {
  it('cannot absorb a player with an EXPIRED TPE', () => {
    const a = player({ id: 'in', salary: 8_000_000, fromTeam: 'YYY', toTeam: 'XXX' });
    const t = team({ abbr: 'XXX', preTier: 'over_cap', incoming: 8_000_000, incomingAssets: [a], exceptions: [{ kind: 'tpe', amount: 10_000_000, expires: '2026-01-01' }] });
    const f = matchingRule(ctx([t], { simulatedDate: '2026-06-24' }));
    expect(f.map((x) => x.code)).toContain('OVER_MATCH'); // expired TPE can't be used → over-match
  });
  it('CAN absorb with an unexpired TPE', () => {
    const a = player({ id: 'in', salary: 8_000_000, fromTeam: 'YYY', toTeam: 'XXX' });
    const t = team({ abbr: 'XXX', preTier: 'over_cap', incoming: 8_000_000, incomingAssets: [a], exceptions: [{ kind: 'tpe', amount: 10_000_000, expires: '2027-01-01' }] });
    const f = matchingRule(ctx([t], { simulatedDate: '2026-06-24' }));
    expect(f.map((x) => x.code)).not.toContain('OVER_MATCH');
  });
});

describe('more timing rules', () => {
  const at = (sim: string, a: Partial<TradeAsset>) =>
    eligibilityRule(ctx([team({ abbr: 'XXX', outgoing: 1, outgoingAssets: [player(a)] })], { simulatedDate: sim })).map((x) => x.code);
  it('blocks DESIGNATED_VET within a year', () => expect(at('2026-09-01', { designatedVetDate: '2026-06-01' })).toContain('DESIGNATED_VET'));
  it('flags MATCHED_RFA conditional within a year', () => expect(at('2026-09-01', { matchedOfferDate: '2026-06-01' })).toContain('MATCHED_RFA'));
  it('notes OVER_38', () => expect(at('2026-09-01', { isOver38: true })).toContain('OVER_38'));
  it('flags the July MORATORIUM window', () =>
    expect(eligibilityRule(ctx([team({ abbr: 'XXX', outgoing: 1, outgoingAssets: [player({})] })], { simulatedDate: '2026-07-02' })).map((x) => x.code)).toContain('MORATORIUM'));
});

describe('frozen-pick derivation', () => {
  it('blocks a recent second-apron team trading its first 7 drafts out', () => {
    // 2026-27 season → startYear 2026 → frozen year 2033.
    const t = team({ abbr: 'PHX', priorSecondApronSeasons: 1, outgoingAssets: [player({ kind: 'pick', round: 1, pickYear: 2033, salary: 0, label: '2033 1st' })] });
    expect(_picks(ctx([t])).map((x) => x.code)).toContain('PICK_FROZEN');
  });
});

describe('repeater derivation', () => {
  it('derives repeater status from 3+ taxpayer seasons in the prior 4', () => {
    const input: TradeInput = {
      season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27, rules: SEASON_RULES_2026_27,
      teams: [{ abbr: 'AAA', preTradeSalary: 100_000_000, priorTaxpayerSeasons: 3 }],
      assets: [],
    };
    expect(buildContext(input).teams[0]!.isRepeaterTaxpayer).toBe(true);
  });
});

describe('one-click auto-fix', () => {
  it('returns actions that make an over-match trade legal', () => {
    const input: TradeInput = {
      season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27, rules: SEASON_RULES_2026_27,
      teams: [{ abbr: 'AAA', preTradeSalary: 200_000_000 }, { abbr: 'BBB', preTradeSalary: 200_000_000 }],
      assets: [
        { id: 'out', kind: 'player', salary: 5_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'Out' },
        { id: 'in1', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'In1' },
        { id: 'in2', kind: 'player', salary: 3_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'In2' },
      ],
    };
    expect(evaluate(input).valid).toBe(false); // AAA sends $5M, takes back $23M → OVER_MATCH
    const actions = planAutoFix(input);
    expect(actions.length).toBeGreaterThan(0);
    let assets = input.assets.map((a) => ({ ...a }));
    for (const act of actions) assets = assets.map((a) => (a.id === act.assetId ? { ...a, toTeam: a.fromTeam } : a));
    expect(evaluate({ ...input, assets }).valid).toBe(true);
  });
});

describe('waive-and-stretch', () => {
  it('spreads dead money over 2*years+1 and flags the 15% limit', () => {
    const r = waiveAndStretch(30_000_000, 2, 170_000_000); // 5 seasons, $6M/yr
    expect(r.years).toBe(5);
    expect(r.perSeason).toBe(6_000_000);
    expect(r.exceedsLimit).toBe(false);
    expect(waiveAndStretch(60_000_000, 1, 100_000_000).exceedsLimit).toBe(true); // 3 seasons, $20M > 15% of $100M
  });
  it('set-off is half of the new deal above the minimum', () => {
    expect(setOff(10_000_000, 2_000_000)).toBe(4_000_000);
    expect(setOff(1_000_000, 2_000_000)).toBe(0);
  });
});

describe('base-year compensation', () => {
  it('reduces the outgoing MATCH value to max(50% new, prior) while keeping full cap-basis outgoing', () => {
    const input: TradeInput = {
      season: SEASON_2026_27, matching: MATCHING_2026_27, apron: APRON_2026_27, rules: SEASON_RULES_2026_27,
      teams: [{ abbr: 'AAA', preTradeSalary: 200_000_000 }, { abbr: 'BBB', preTradeSalary: 100_000_000 }],
      assets: [{ id: 'byc', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'BYC', isBaseYearComp: true, bycPriorSalary: 8_000_000 }],
    };
    const aaa = buildContext(input).teams.find((t) => t.abbr === 'AAA')!;
    expect(aaa.outgoing).toBe(20_000_000); // actual cap salary leaving
    expect(aaa.outgoingMatch).toBe(10_000_000); // max(0.5*20M, 8M) = 10M for matching
  });
});

describe('Stepien swap crediting', () => {
  it('does NOT flag Stepien when a SWAP (not the outright pick) is traded', () => {
    const owned = [{ year: 2027 }, { year: 2028, isSwap: true }, { year: 2029 }];
    const t = team({ abbr: 'GSW', ownedFirstRoundPicks: owned, outgoingAssets: [player({ kind: 'pick', round: 1, pickYear: 2028, isSwap: true, salary: 0 })] });
    expect(picksRule(ctx([t])).map((x) => x.code)).not.toContain('STEPIEN_VIOLATION');
  });
  it('flags Stepien when consecutive OUTRIGHT firsts are gone', () => {
    const owned = [{ year: 2027 }, { year: 2028 }, { year: 2029 }];
    const t = team({
      abbr: 'GSW', ownedFirstRoundPicks: owned,
      outgoingAssets: [player({ id: 'x', kind: 'pick', round: 1, pickYear: 2027, salary: 0 }), player({ id: 'y', kind: 'pick', round: 1, pickYear: 2028, salary: 0 })],
    });
    expect(picksRule(ctx([t])).map((x) => x.code)).toContain('STEPIEN_VIOLATION');
  });
});
