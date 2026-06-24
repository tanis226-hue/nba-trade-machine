import { describe, it, expect } from 'vitest';
import { eligibilityRule } from '../eligibility';
import type { PerTeamContext, RuleContext, TradeAsset } from '../../types';

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

function player(partial: Partial<TradeAsset>): TradeAsset {
  return {
    id: partial.id ?? 'p1',
    kind: 'player',
    salary: 10_000_000,
    fromTeam: 'XXX',
    toTeam: 'YYY',
    label: 'Player One',
    ...partial,
  };
}

function makeCtx(team: PerTeamContext, opts: Partial<RuleContext> = {}): RuleContext {
  return {
    season: { season: '2025-26', salaryCap: 154_000_000, taxLine: 187_000_000, firstApron: 195_000_000, secondApron: 207_000_000 },
    matching: { belowApron: [], apronTakebackPct: 1 } as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams: [team],
    assets: team.outgoingAssets,
    ...opts,
  };
}

describe('eligibilityRule', () => {
  it('no-ops when simulatedDate is absent', () => {
    const p = player({ signedDate: '2025-10-01', extendedDate: '2025-10-01' });
    const team = makeTeam({ abbr: 'BOS', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    expect(eligibilityRule(makeCtx(team))).toEqual([]);
  });

  it('NEGATIVE: returns [] when all windows have elapsed', () => {
    const p = player({ signedDate: '2025-07-01', acquiredDate: '2025-07-01', extendedDate: '2025-07-01' });
    const team = makeTeam({ abbr: 'BOS', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const findings = eligibilityRule(makeCtx(team, { simulatedDate: '2026-06-01' }));
    expect(findings).toEqual([]);
  });

  it('flags RECENTLY_SIGNED conditional and picks Dec 15 when it is later than +3mo', () => {
    // Signed Sept 20 → +3mo = Dec 20, but Dec 15 is earlier, so +3mo wins (Dec 20).
    // Use an Oct-late sign so +3mo lands before Dec 15: signed Sept 1 → Dec 1, Dec 15 later.
    const p = player({ signedDate: '2025-09-01', label: 'Newbie' });
    const team = makeTeam({ abbr: 'LAL', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const ctx = makeCtx(team, {
      simulatedDate: '2025-11-01',
      rules: { calendar: { decGuaranteeEligible: '2025-12-15' } } as any,
    });
    const f = eligibilityRule(ctx);
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('RECENTLY_SIGNED');
    expect(f[0].severity).toBe('conditional');
    expect(f[0].legalOnDate).toBe('2025-12-15'); // +3mo (Dec 1) < Dec 15 → Dec 15 wins
  });

  it('uses +3mo when later than Dec 15', () => {
    const p = player({ signedDate: '2025-10-01', label: 'Newbie' });
    const team = makeTeam({ abbr: 'LAL', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const ctx = makeCtx(team, {
      simulatedDate: '2025-11-01',
      rules: { calendar: { decGuaranteeEligible: '2025-12-15' } } as any,
    });
    const f = eligibilityRule(ctx);
    expect(f[0].legalOnDate).toBe('2026-01-01'); // +3mo (Jan 1) > Dec 15 → Jan 1 wins
  });

  it('blocks AGG_LOCK only when the team aggregates 2+ players', () => {
    const p1 = player({ id: 'a', label: 'Acquired', acquiredDate: '2026-05-01' });
    const p2 = player({ id: 'b', label: 'Other', salary: 5_000_000 });

    // Single player out: no aggregation, no AGG_LOCK.
    const solo = makeTeam({ abbr: 'NYK', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p1] });
    expect(eligibilityRule(makeCtx(solo, { simulatedDate: '2026-05-15' }))).toEqual([]);

    // Two players out: AGG_LOCK fires.
    const agg = makeTeam({ abbr: 'NYK', outgoing: 15_000_000, playersOut: 2, outgoingAssets: [p1, p2] });
    const f = eligibilityRule(makeCtx(agg, { simulatedDate: '2026-05-15' }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('AGG_LOCK');
    expect(f[0].severity).toBe('block');
    expect(f[0].legalOnDate).toBe('2026-07-01');
    expect(f[0].fix).toBeTruthy();
  });

  it('blocks EXT_FREEZE within ~6 months of the extension', () => {
    const p = player({ extendedDate: '2026-03-01', label: 'Extended' });
    const team = makeTeam({ abbr: 'MIA', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const f = eligibilityRule(makeCtx(team, { simulatedDate: '2026-05-01' }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('EXT_FREEZE');
    expect(f[0].severity).toBe('block');
    expect(f[0].legalOnDate).toBe('2026-09-01');
  });

  it('blocks NO_TRADE_BACK when an acquired player is routed back to the team that traded him within 1 year', () => {
    const p = player({ label: 'Boomerang', acquiredDate: '2026-06-23', acquiredFrom: 'MIL', toTeam: 'MIL' });
    const team = makeTeam({ abbr: 'MIA', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const f = eligibilityRule(makeCtx(team, { simulatedDate: '2026-06-24' }));
    const ntb = f.find((x) => x.code === 'NO_TRADE_BACK');
    expect(ntb).toBeTruthy();
    expect(ntb!.severity).toBe('block');
    expect(ntb!.legalOnDate).toBe('2027-06-23');
  });

  it('allows NO_TRADE_BACK player when routed to a DIFFERENT team', () => {
    const p = player({ label: 'Boomerang', acquiredDate: '2026-06-23', acquiredFrom: 'MIL', toTeam: 'CHI' });
    const team = makeTeam({ abbr: 'MIA', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const f = eligibilityRule(makeCtx(team, { simulatedDate: '2026-06-24' }));
    expect(f.find((x) => x.code === 'NO_TRADE_BACK')).toBeFalsy();
  });

  it('allows NO_TRADE_BACK once a year has elapsed', () => {
    const p = player({ label: 'Boomerang', acquiredDate: '2026-06-23', acquiredFrom: 'MIL', toTeam: 'MIL' });
    const team = makeTeam({ abbr: 'MIA', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [p] });
    const f = eligibilityRule(makeCtx(team, { simulatedDate: '2027-07-01' }));
    expect(f.find((x) => x.code === 'NO_TRADE_BACK')).toBeFalsy();
  });

  it('ignores non-player assets and degrades gracefully on missing dates', () => {
    const pick: TradeAsset = { id: 'pk', kind: 'pick', salary: 0, fromTeam: 'XXX', toTeam: 'YYY', label: '2027 1st', pickYear: 2027, round: 1 };
    const p = player({ label: 'No Dates' }); // no signed/acquired/extended dates
    const team = makeTeam({ abbr: 'DAL', outgoing: 10_000_000, playersOut: 1, outgoingAssets: [pick, p] });
    expect(eligibilityRule(makeCtx(team, { simulatedDate: '2026-01-01' }))).toEqual([]);
  });
});
