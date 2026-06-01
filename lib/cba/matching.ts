import type { ApronTier, MatchingRules } from './types';

export function maxIncomingSalary(outgoing: number, tier: ApronTier, rules: MatchingRules): number {
  if (tier === 'first_apron' || tier === 'second_apron') {
    return outgoing * rules.apronTakebackPct;
  }
  const b = rules.belowApron.find((br) => outgoing <= br.upTo) ?? rules.belowApron[rules.belowApron.length - 1];
  return outgoing * b.pct + b.add;
}
