import type { SeasonCap, MatchingRules, ApronRules, SeasonRules, TaxBracket, LeagueCalendar } from './types';

// 2025-26 official figures. Sources in spec section 11. VERIFY each cap year before refresh.
export const SEASON_2025_26: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_647_000,
  taxLine: 187_895_000,
  firstApron: 195_945_000,
  secondApron: 207_824_000,
  minTeamSalary: 139_182_000, // 90% of cap
};

// Below first apron: <=$7.5M -> 200%+$250K; $7.5M-$29M -> outgoing+$7.5M; >$29M -> 125%+$250K.
export const MATCHING_2025_26: MatchingRules = {
  belowApron: [
    { upTo: 7_500_000, pct: 2.0, add: 250_000 },
    { upTo: 29_000_000, pct: 1.0, add: 7_500_000 },
    { upTo: Infinity, pct: 1.25, add: 250_000 },
  ],
  apronTakebackPct: 1.0, // over first apron (incl. second): 100%
};

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

// Luxury-tax brackets: rate applied to each $5M step OVER the tax line. // VERIFY 2025-26 repeater steps beyond $20M.
export const TAX_BRACKETS_2025_26: TaxBracket[] = [
  { upTo: 5_000_000, rate: 1.5, repeaterRate: 2.5 },
  { upTo: 10_000_000, rate: 1.75, repeaterRate: 2.75 },
  { upTo: 15_000_000, rate: 2.5, repeaterRate: 3.5 },
  { upTo: 20_000_000, rate: 3.25, repeaterRate: 4.25 },
  { upTo: Infinity, rate: 3.75, repeaterRate: 4.75 },
];

// Key league dates for the 2025-26 league year. // VERIFY exact dates each season.
export const LEAGUE_CALENDAR_2025_26: LeagueCalendar = {
  tradeDeadline: '2026-02-05',
  decGuaranteeEligible: '2025-12-15',
  janFifteen: '2026-01-15',
  moratoriumEnd: '2025-07-06',
  aggregationCutoff: '2025-12-15',
};

export const CASH_LIMIT_2025_26 = 7_970_000; // annual cash-in-trade limit. // VERIFY.

/** Full season rule bundle the engine consumes (cap + matching + apron + tax + calendar + cash). */
export const SEASON_RULES_2025_26: SeasonRules = {
  cap: SEASON_2025_26,
  matching: MATCHING_2025_26,
  apron: APRON_2025_26,
  taxBrackets: TAX_BRACKETS_2025_26,
  calendar: LEAGUE_CALENDAR_2025_26,
  cashLimit: CASH_LIMIT_2025_26,
};

// ===== 2026-27 (base/working season). PROJECTED landmarks — VERIFY against official figures once
// the NBA sets the 2026-27 cap. Apron/matching/tax STRUCTURE is CBA-fixed; only the dollar
// thresholds drift with the cap, so the brackets below mirror 2025-26 pending official numbers.
export const SEASON_2026_27: SeasonCap = {
  season: '2026-27',
  salaryCap: 170_100_000, // PROJECTED (+~10%)
  taxLine: 207_800_000, // PROJECTED
  firstApron: 216_600_000, // PROJECTED
  secondApron: 229_800_000, // PROJECTED
  minTeamSalary: 153_090_000, // 90% of projected cap
};

export const MATCHING_2026_27: MatchingRules = {
  belowApron: [
    { upTo: 7_500_000, pct: 2.0, add: 250_000 }, // PROJECTED thresholds; rise with the cap
    { upTo: 29_000_000, pct: 1.0, add: 7_500_000 },
    { upTo: Infinity, pct: 1.25, add: 250_000 },
  ],
  apronTakebackPct: 1.0,
};

export const APRON_2026_27: ApronRules = APRON_2025_26; // tool restrictions are CBA-fixed, season-independent

export const TAX_BRACKETS_2026_27: TaxBracket[] = TAX_BRACKETS_2025_26; // rate structure unchanged; VERIFY repeater rates

export const LEAGUE_CALENDAR_2026_27: LeagueCalendar = {
  tradeDeadline: '2027-02-04',
  decGuaranteeEligible: '2026-12-15',
  janFifteen: '2027-01-15',
  moratoriumEnd: '2026-07-06',
  aggregationCutoff: '2026-12-15',
};

export const CASH_LIMIT_2026_27 = 8_300_000; // PROJECTED annual cash-in-trade limit

export const SEASON_RULES_2026_27: SeasonRules = {
  cap: SEASON_2026_27,
  matching: MATCHING_2026_27,
  apron: APRON_2026_27,
  taxBrackets: TAX_BRACKETS_2026_27,
  calendar: LEAGUE_CALENDAR_2026_27,
  cashLimit: CASH_LIMIT_2026_27,
};
