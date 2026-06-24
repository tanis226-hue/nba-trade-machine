import { describe, it, expect } from 'vitest';
import { secondApronExtrasRule } from '../secondApronExtras';
import type {
  RuleContext,
  PerTeamContext,
  TradeAsset,
  ApronTier,
} from '../../types';

function makeTeam(partial: Partial<PerTeamContext>): PerTeamContext {
  const tier: ApronTier = partial.preTier ?? 'below_cap';
  return {
    abbr: partial.abbr ?? 'AAA',
    outgoing: partial.outgoing ?? 0,
    incoming: partial.incoming ?? 0,
    postSalary: partial.postSalary ?? 0,
    preTier: tier,
    postTier: partial.postTier ?? tier,
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

function makeCtx(teams: PerTeamContext[], assets: TradeAsset[]): RuleContext {
  return {
    season: {
      season: '2025-26',
      salaryCap: 154_647_000,
      taxLine: 187_895_000,
      firstApron: 195_945_000,
      secondApron: 207_824_000,
    },
    matching: { belowApron: [], apronTakebackPct: 1 } as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams,
    assets,
  };
}

describe('secondApronExtrasRule', () => {
  it('blocks a second-apron team from sending cash', () => {
    const cash: TradeAsset = {
      id: 'c1',
      kind: 'cash',
      salary: 0,
      fromTeam: 'BOS',
      toTeam: 'OKC',
      label: 'Cash',
      amount: 5_000_000,
    };
    const ctx = makeCtx(
      [
        makeTeam({ abbr: 'BOS', preTier: 'second_apron', outgoing: 1 }),
        makeTeam({ abbr: 'OKC', preTier: 'over_cap', incoming: 1 }),
      ],
      [cash],
    );
    const out = secondApronExtrasRule(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('SECOND_APRON_CASH');
    expect(out[0].teamAbbr).toBe('BOS');
    expect(out[0].severity).toBe('block');
    expect(out[0].fix).toBeTruthy();
  });

  it('ALLOWS a second-apron team to RECEIVE cash (only sending is barred)', () => {
    const cash: TradeAsset = {
      id: 'c1',
      kind: 'cash',
      salary: 0,
      fromTeam: 'OKC',
      toTeam: 'PHX',
      label: 'Cash',
      amount: 3_000_000,
    };
    const ctx = makeCtx(
      [
        makeTeam({ abbr: 'PHX', preTier: 'second_apron', incoming: 1 }),
        makeTeam({ abbr: 'OKC', preTier: 'over_cap', outgoing: 1 }),
      ],
      [cash],
    );
    const out = secondApronExtrasRule(ctx);
    expect(out.map((f) => f.code)).not.toContain('SECOND_APRON_CASH');
  });

  it('blocks a second-apron team absorbing players via a sign-and-trade-created exception', () => {
    const player: TradeAsset = {
      id: 'p1',
      kind: 'player',
      salary: 10_000_000,
      fromTeam: 'UTA',
      toTeam: 'PHX',
      label: 'Incoming Player',
    };
    const ctx = makeCtx(
      [
        makeTeam({
          abbr: 'PHX',
          preTier: 'second_apron',
          incoming: 1,
          exceptions: [
            { kind: 'tpe', amount: 12_000_000, createdFromSignAndTrade: true },
          ],
          incomingAssets: [player],
        }),
        makeTeam({ abbr: 'UTA', preTier: 'over_cap', outgoing: 1 }),
      ],
      [player],
    );
    const out = secondApronExtrasRule(ctx);
    expect(out.map((f) => f.code)).toContain('SECOND_APRON_ST_TPE');
  });

  it('returns no findings when the team is not at the second apron and no cash is involved', () => {
    const player: TradeAsset = {
      id: 'p1',
      kind: 'player',
      salary: 10_000_000,
      fromTeam: 'UTA',
      toTeam: 'PHX',
      label: 'Incoming Player',
    };
    const ctx = makeCtx(
      [
        makeTeam({
          abbr: 'PHX',
          preTier: 'first_apron',
          incoming: 1,
          exceptions: [
            { kind: 'tpe', amount: 12_000_000, createdFromSignAndTrade: true },
          ],
          incomingAssets: [player],
        }),
        makeTeam({ abbr: 'UTA', preTier: 'over_cap', outgoing: 1 }),
      ],
      [player],
    );
    const out = secondApronExtrasRule(ctx);
    expect(out).toEqual([]);
  });

  it('no-ops a second-apron team with an ordinary exception and no cash', () => {
    const player: TradeAsset = {
      id: 'p1',
      kind: 'player',
      salary: 8_000_000,
      fromTeam: 'UTA',
      toTeam: 'PHX',
      label: 'Incoming Player',
    };
    const ctx = makeCtx(
      [
        makeTeam({
          abbr: 'PHX',
          preTier: 'second_apron',
          incoming: 1,
          exceptions: [{ kind: 'tpe', amount: 9_000_000 }],
          incomingAssets: [player],
        }),
      ],
      [player],
    );
    const out = secondApronExtrasRule(ctx);
    expect(out).toEqual([]);
  });
});
