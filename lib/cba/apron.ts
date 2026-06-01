import type { ApronTier, ApronRules, ApronTierRules } from './types';

export function restrictionsFor(tier: ApronTier, rules: ApronRules): ApronTierRules {
  if (tier === 'second_apron') return rules.secondApron;
  if (tier === 'first_apron') return rules.firstApron;
  return { canAggregate: true, maxTakebackPct: Infinity, blockedTools: [] };
}
