import { describe, it, expect } from 'vitest';
import { picksRule } from '../picks';
import type {
  PerTeamContext,
  RuleContext,
  SeasonCap,
  TradeAsset,
} from '../../types';

const season: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_647_000,
  taxLine: 187_895_000,
  firstApron: 195_945_000,
  secondApron: 207_824_000,
};

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

function pick(partial: Partial<TradeAsset>): TradeAsset {
  return {
    id: partial.id ?? 'p1',
    kind: 'pick',
    salary: 0,
    fromTeam: 'XXX',
    toTeam: 'YYY',
    label: partial.label ?? 'pick',
    round: 1,
    ...partial,
  };
}

function ctxWith(teams: PerTeamContext[]): RuleContext {
  return {
    season,
    matching: {} as any,
    apron: {} as any,
    tradeMethod: 'simultaneous',
    teams,
    assets: teams.flatMap((t) => t.outgoingAssets),
  };
}

describe('picksRule', () => {
  it('blocks a pick more than seven drafts out (seven-year rule)', () => {
    const p = pick({ pickYear: 2033, label: '2033 first' }); // 2033 - 2025 = 8 > 7
    const team = makeTeam({ abbr: 'BOS', outgoingAssets: [p] });
    const findings = picksRule(ctxWith([team]));
    expect(findings.some((f) => f.code === 'PICK_TOO_FAR')).toBe(true);
    const f = findings.find((x) => x.code === 'PICK_TOO_FAR')!;
    expect(f.severity).toBe('block');
    expect(f.citation).toBeTruthy();
    expect(f.fix).toBeTruthy();
  });

  it('allows a pick exactly seven drafts out (boundary)', () => {
    const p = pick({ pickYear: 2032, label: '2032 first' }); // 2032 - 2025 = 7, not > 7
    const team = makeTeam({
      abbr: 'BOS',
      outgoingAssets: [p],
      ownedFirstRoundPicks: [{ year: 2032 }],
    });
    const findings = picksRule(ctxWith([team]));
    expect(findings.some((f) => f.code === 'PICK_TOO_FAR')).toBe(false);
  });

  it('blocks a frozen pick', () => {
    const p = pick({ pickYear: 2027, label: '2027 first', isFrozen: true });
    const team = makeTeam({ abbr: 'PHX', outgoingAssets: [p] });
    const findings = picksRule(ctxWith([team]));
    const f = findings.find((x) => x.code === 'PICK_FROZEN');
    expect(f).toBeTruthy();
    expect(f!.severity).toBe('block');
    expect(f!.fix).toBeTruthy();
  });

  it('blocks a Stepien violation (no first in two consecutive years)', () => {
    // Team owns 2026, 2027, 2028 firsts; trades away 2027 → 2027 & 2028? No, 2028 kept.
    // Trade away 2026 and 2027 → left without firsts in 2026 and 2027 (consecutive).
    const team = makeTeam({
      abbr: 'LAL',
      outgoingAssets: [
        pick({ id: 'a', pickYear: 2026, label: '2026 first', round: 1 }),
        pick({ id: 'b', pickYear: 2027, label: '2027 first', round: 1 }),
      ],
      ownedFirstRoundPicks: [{ year: 2026 }, { year: 2027 }, { year: 2028 }],
    });
    const findings = picksRule(ctxWith([team]));
    const f = findings.find((x) => x.code === 'STEPIEN_VIOLATION');
    expect(f).toBeTruthy();
    expect(f!.severity).toBe('block');
  });

  it('does not flag Stepien when a first remains every other year', () => {
    // Trade away 2026 only; team keeps 2027 and 2028 → no consecutive gap.
    const team = makeTeam({
      abbr: 'LAL',
      outgoingAssets: [
        pick({ id: 'a', pickYear: 2026, label: '2026 first', round: 1 }),
      ],
      ownedFirstRoundPicks: [{ year: 2026 }, { year: 2027 }, { year: 2028 }],
    });
    const findings = picksRule(ctxWith([team]));
    expect(findings.some((f) => f.code === 'STEPIEN_VIOLATION')).toBe(false);
  });

  it('NEGATIVE: clean trade with valid near pick and no Stepien data returns []', () => {
    const p = pick({ pickYear: 2027, label: '2027 second', round: 2 });
    const team = makeTeam({ abbr: 'MIA', outgoingAssets: [p] });
    // ownedFirstRoundPicks undefined → Stepien skipped; pick is near and unfrozen.
    expect(picksRule(ctxWith([team]))).toEqual([]);
  });
});
