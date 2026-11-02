import type { SeasonCap, MatchingRules, ApronRules, SeasonRules, TaxBracket, LeagueCalendar } from './types';

// Primary sources, reviewed 2026-11-02:
// https://www.nba.com/news/nba-salary-cap-2026-27-season
// https://www.nba.com/news/key-dates
// https://nbpa.com/cba — 2023 CBA Art. VII §§2(d), 6(j)(1)(iv), 8(a).
export const CBA_BASE_CAP = 136_021_000; // official 2023-24 cap; the CBA's indexing denominator

/** Exact breakpoints of max(min(2*out + 250k, out + indexed allowance), 1.25*out + 250k). */
export function matchingRulesForCap(salaryCap: number): MatchingRules {
  const allowance = 7_500_000 * salaryCap / CBA_BASE_CAP;
  const firstBreakpoint = allowance - 250_000;
  return {
    belowApron: [
      { upTo: firstBreakpoint, pct: 2, add: 250_000 },
      { upTo: firstBreakpoint * 4, pct: 1, add: allowance },
      { upTo: Infinity, pct: 1.25, add: 250_000 },
    ],
    apronTakebackPct: 1,
  };
}

/** Rates effective from 2025-26; band widths grow with the cap, including the escalating tail. */
export function taxBracketsForCap(salaryCap: number): TaxBracket[] {
  const width = 5_000_000 * salaryCap / CBA_BASE_CAP;
  return [
    { upTo: width, rate: 1, repeaterRate: 3 },
    { upTo: width * 2, rate: 1.25, repeaterRate: 3.25 },
    { upTo: width * 3, rate: 3.5, repeaterRate: 5.5 },
    { upTo: width * 4, rate: 4.75, repeaterRate: 6.75 },
    { upTo: Infinity, rate: 5.25, repeaterRate: 7.25, increment: { width, rate: 0.5 } },
  ];
}

// Official 2025-26 figures, retained for historical proposals.
export const SEASON_2025_26: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_647_000,
  taxLine: 187_895_000,
  firstApron: 195_945_000,
  secondApron: 207_824_000,
  minTeamSalary: 139_182_000, // 90% of cap
};

export const MATCHING_2025_26 = matchingRulesForCap(SEASON_2025_26.salaryCap);

export const APRON_2025_26: ApronRules = {
  firstApron: {
    canAggregate: true,
    maxTakebackPct: 1.0,
    blockedTools: ['sign_and_trade', 'bae', 'non_taxpayer_mle', 'prior_year_tpe'],
  },
  secondApron: {
    canAggregate: false,
    maxTakebackPct: 1.0,
    blockedTools: ['mle', 'aggregation', 'cash_out', 'sign_and_trade_tpe', 'frozen_pick'],
  },
};

export const TAX_BRACKETS_2025_26 = taxBracketsForCap(SEASON_2025_26.salaryCap);

// Key league dates for the 2025-26 league year. // VERIFY exact dates each season.
export const LEAGUE_CALENDAR_2025_26: LeagueCalendar = {
  tradeDeadline: '2026-02-05',
  decGuaranteeEligible: '2025-12-15',
  janFifteen: '2026-01-15',
  moratoriumEnd: '2025-07-06',
  aggregationCutoff: '2025-12-15',
};

export const CASH_LIMIT_2025_26 = SEASON_2025_26.salaryCap * 0.0515;

/** Full season rule bundle the engine consumes (cap + matching + apron + tax + calendar + cash). */
export const SEASON_RULES_2025_26: SeasonRules = {
  cap: SEASON_2025_26,
  matching: MATCHING_2025_26,
  apron: APRON_2025_26,
  taxBrackets: TAX_BRACKETS_2025_26,
  calendar: LEAGUE_CALENDAR_2025_26,
  cashLimit: CASH_LIMIT_2025_26,
};

// Official 2026-27 landmarks, announced June 30, 2026. Future-season cap sheets remain projections.
export const SEASON_2026_27: SeasonCap = {
  season: '2026-27',
  salaryCap: 164_961_000,
  taxLine: 200_428_000,
  firstApron: 209_015_000,
  secondApron: 221_686_000,
  minTeamSalary: 148_465_000,
};

export const MATCHING_2026_27 = matchingRulesForCap(SEASON_2026_27.salaryCap);

export const APRON_2026_27: ApronRules = APRON_2025_26; // tool restrictions are CBA-fixed, season-independent

export const TAX_BRACKETS_2026_27 = taxBracketsForCap(SEASON_2026_27.salaryCap);

export const LEAGUE_CALENDAR_2026_27: LeagueCalendar = {
  tradeDeadline: '2027-02-11',
  decGuaranteeEligible: '2026-12-15',
  janFifteen: '2027-01-15',
  moratoriumEnd: '2026-07-06',
  aggregationCutoff: '2026-12-15',
};

export const CASH_LIMIT_2026_27 = SEASON_2026_27.salaryCap * 0.0515;

export const SEASON_RULES_2026_27: SeasonRules = {
  cap: SEASON_2026_27,
  matching: MATCHING_2026_27,
  apron: APRON_2026_27,
  taxBrackets: TAX_BRACKETS_2026_27,
  calendar: LEAGUE_CALENDAR_2026_27,
  cashLimit: CASH_LIMIT_2026_27,
};
