import { describe, it, expect } from 'vitest';
import { ntcRule } from '../ntc';
import type {
  PerTeamContext,
  RuleContext,
  TradeAsset,
  SeasonCap,
  MatchingRules,
  ApronRules,
} from '../../types';

function makeTeam(partial: Partial<PerTeamContext>): PerTeamContext {
  return {
    abbr: 'AAA',
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

function player(partial: Partial<TradeAsset>): TradeAsset {
  return {
    id: 'p1',
    kind: 'player',
    salary: 10_000_000,
    fromTeam: 'AAA',
    toTeam: 'BBB',
    label: 'Player One',
    ...partial,
  };
}

const season: SeasonCap = {
  season: '2024-25',
  salaryCap: 140_000_000,
  taxLine: 170_000_000,
  firstApron: 178_000_000,
  secondApron: 189_000_000,
};
const matching = {} as MatchingRules;
const apron = {} as ApronRules;

function ctxWith(teams: PerTeamContext[]): RuleContext {
  return {
    season,
    matching,
    apron,
    tradeMethod: 'simultaneous',
    teams,
    assets: teams.flatMap((t) => [...t.outgoingAssets, ...t.incomingAssets]),
  };
}

describe('ntcRule', () => {
  it('flags an outgoing player with an explicit no-trade clause', () => {
    const p = player({ noTradeClause: true, label: 'Star Veteran' });
    const out = ntcRule(ctxWith([makeTeam({ abbr: 'LAL', outgoingAssets: [p] })]));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('NTC_CONSENT');
    expect(out[0].severity).toBe('warning');
    expect(out[0].teamAbbr).toBe('LAL');
    expect(out[0].message).toContain('no-trade clause');
    expect(out[0].citation).toContain('Art. VII');
    expect(out[0].fix).toBeTruthy();
  });

  it('flags an implied NTC (one-year Bird re-sign / one-year-plus-option)', () => {
    const p = player({ impliedNtc: true, label: 'Bird Resign' });
    const out = ntcRule(ctxWith([makeTeam({ abbr: 'BOS', outgoingAssets: [p] })]));
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('warning');
    expect(out[0].message).toContain('implied no-trade right');
  });

  it('returns [] when no outgoing player has any veto right (negative case)', () => {
    const p = player({ noTradeClause: false, impliedNtc: false });
    const out = ntcRule(ctxWith([makeTeam({ abbr: 'NYK', outgoingAssets: [p] })]));
    expect(out).toEqual([]);
  });

  it('ignores incoming NTC players and non-player assets', () => {
    const incomingStar = player({ noTradeClause: true, fromTeam: 'BBB', toTeam: 'AAA' });
    const pick: TradeAsset = {
      id: 'pk1',
      kind: 'pick',
      salary: 0,
      fromTeam: 'AAA',
      toTeam: 'BBB',
      label: '2027 1st',
      noTradeClause: true,
    };
    const out = ntcRule(
      ctxWith([makeTeam({ abbr: 'AAA', outgoingAssets: [pick], incomingAssets: [incomingStar] })]),
    );
    expect(out).toEqual([]);
  });

  it('flags multiple outgoing NTC players across teams', () => {
    const a = player({ noTradeClause: true, label: 'A', id: 'a' });
    const b = player({ impliedNtc: true, label: 'B', id: 'b', fromTeam: 'BBB', toTeam: 'AAA' });
    const out = ntcRule(
      ctxWith([
        makeTeam({ abbr: 'AAA', outgoingAssets: [a] }),
        makeTeam({ abbr: 'BBB', outgoingAssets: [b] }),
      ]),
    );
    expect(out).toHaveLength(2);
    expect(out.map((f) => f.teamAbbr).sort()).toEqual(['AAA', 'BBB']);
  });
});
