import type { SeasonCap, MatchingRules, ApronRules } from './types';

// 2025-26 official figures. Sources in spec section 11. VERIFY each cap year before refresh.
export const SEASON_2025_26: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_647_000,
  taxLine: 187_895_000,
  firstApron: 195_945_000,
  secondApron: 207_824_000,
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
