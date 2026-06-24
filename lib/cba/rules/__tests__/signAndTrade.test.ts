import { describe, it, expect } from 'vitest';
import { signAndTradeRule } from '../signAndTrade';
import type { PerTeamContext, RuleContext, TradeAsset, ApronTier } from '../../types';

function makeTeam(partial: Partial<PerTeamContext> & { abbr: string }): PerTeamContext {
  return {
    abbr: partial.abbr,
    outgoing: partial.outgoing ?? 0,
    incoming: partial.incoming ?? 0,
    postSalary: partial.postSalary ?? 0,
    preTier: partial.preTier ?? ('over_cap' as ApronTier),
    postTier: partial.postTier ?? ('over_cap' as ApronTier),
    playersOut: partial.playersOut ?? 0,
    preTradeSalary: partial.preTradeSalary ?? 0,
    apronSalary: partial.apronSalary ?? 0,
    capSpace: partial.capSpace,
    hardCapLine: partial.hardCapLine ?? null,
    exceptions: partial.exceptions ?? [],
    rosterCount: partial.rosterCount,
    openRosterSpots: partial.openRosterSpots,
    priorSecondApronSeasons: partial.priorSecondApronSeasons,
    isRepeaterTaxpayer: partial.isRepeaterTaxpayer,
    ownedFirstRoundPicks: partial.ownedFirstRoundPicks,
    outgoingAssets: partial.outgoingAssets ?? [],
    incomingAssets: partial.incomingAssets ?? [],
  };
}

function stPlayer(partial: Partial<TradeAsset> & { id: string; label: string }): TradeAsset {
  return {
    id: partial.id,
    kind: 'player',
    salary: partial.salary ?? 20_000_000,
    fromTeam: partial.fromTeam ?? 'OTH',
    toTeam: partial.toTeam ?? 'AAA',
    label: partial.label,
    signedVia: partial.signedVia ?? 'sign_and_trade',
    futureSalaries: partial.futureSalaries,
  };
}

function ctxWith(teams: PerTeamContext[]): RuleContext {
  return {
    season: { season: '2025-26', salaryCap: 154_000_000, taxLine: 187_000_000, firstApron: 195_000_000, secondApron: 207_000_000 },
    matching: {} as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams,
    assets: teams.flatMap((t) => [...t.incomingAssets, ...t.outgoingAssets]),
  };
}

describe('signAndTradeRule', () => {
  it('blocks a team over the first apron from acquiring via sign-and-trade', () => {
    const team = makeTeam({
      abbr: 'AAA',
      preTier: 'first_apron',
      incomingAssets: [
        stPlayer({ id: 'p1', label: 'Star Guard', toTeam: 'AAA', futureSalaries: [{ season: '2026-27', salary: 20_000_000 }, { season: '2027-28', salary: 20_000_000 }] }),
      ],
    });
    const findings = signAndTradeRule(ctxWith([team]));
    expect(findings.map((f) => f.code)).toContain('ST_OVER_APRON');
    const blk = findings.find((f) => f.code === 'ST_OVER_APRON')!;
    expect(blk.severity).toBe('block');
    expect(blk.citation).toBeTruthy();
    expect(blk.fix).toBeTruthy();
  });

  it('blocks a sign-and-trade contract shorter than 3 years', () => {
    const team = makeTeam({
      abbr: 'BBB',
      preTier: 'over_cap',
      incomingAssets: [
        // 1 current + 1 future = 2 years → too short
        stPlayer({ id: 'p2', label: 'Wing', toTeam: 'BBB', futureSalaries: [{ season: '2026-27', salary: 18_000_000 }] }),
      ],
    });
    const findings = signAndTradeRule(ctxWith([team]));
    expect(findings.map((f) => f.code)).toContain('ST_SHORT_TERM');
    expect(findings.find((f) => f.code === 'ST_SHORT_TERM')!.severity).toBe('block');
  });

  it('returns [] for a below-apron team acquiring a valid 3-year sign-and-trade', () => {
    const team = makeTeam({
      abbr: 'CCC',
      preTier: 'over_cap',
      incomingAssets: [
        stPlayer({ id: 'p3', label: 'Forward', toTeam: 'CCC', futureSalaries: [{ season: '2026-27', salary: 20_000_000 }, { season: '2027-28', salary: 20_000_000 }] }),
      ],
    });
    expect(signAndTradeRule(ctxWith([team]))).toEqual([]);
  });

  it('no-ops on the length check when futureSalaries is absent (still blocks apron)', () => {
    const team = makeTeam({
      abbr: 'DDD',
      preTier: 'second_apron',
      incomingAssets: [stPlayer({ id: 'p4', label: 'Center', toTeam: 'DDD' })],
    });
    const findings = signAndTradeRule(ctxWith([team]));
    expect(findings.map((f) => f.code)).toEqual(['ST_OVER_APRON']);
  });

  it('ignores non-sign-and-trade incoming players', () => {
    const team = makeTeam({
      abbr: 'EEE',
      preTier: 'first_apron',
      incomingAssets: [stPlayer({ id: 'p5', label: 'Vet', toTeam: 'EEE', signedVia: 'bird', futureSalaries: [{ season: '2026-27', salary: 5_000_000 }] })],
    });
    expect(signAndTradeRule(ctxWith([team]))).toEqual([]);
  });
});
