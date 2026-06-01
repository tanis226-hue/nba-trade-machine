import type { SeasonCap, MatchingRules, ApronRules } from '@/lib/cba/types';

export const season: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };

export const matching: MatchingRules = {
  belowApron: [
    { upTo: 10, pct: 2.0, add: 1 },
    { upTo: 30, pct: 1.0, add: 8 },
    { upTo: Infinity, pct: 1.25, add: 1 },
  ],
  apronTakebackPct: 1.0,
};

export const apron: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.0, blockedTools: [] },
  secondApron: { canAggregate: false, maxTakebackPct: 1.0, blockedTools: [] },
};
