import { describe, it, expect } from 'vitest';
import { maxIncomingSalary } from '@/lib/cba/matching';
import type { MatchingRules } from '@/lib/cba/types';

const rules: MatchingRules = {
  belowApron: [
    { upTo: 10, pct: 2.0, add: 1 },
    { upTo: 30, pct: 1.0, add: 8 },
    { upTo: Infinity, pct: 1.25, add: 1 },
  ],
  apronTakebackPct: 1.0,
};

describe('maxIncomingSalary', () => {
  it('tier 1 (<=10): 200% + add', () => expect(maxIncomingSalary(5, 'over_cap', rules)).toBe(11)); // 5*2+1
  it('tier 2 (10-30): outgoing + add', () => expect(maxIncomingSalary(20, 'over_tax', rules)).toBe(28)); // 20*1+8
  it('tier 3 (>30): 125% + add', () => expect(maxIncomingSalary(40, 'over_cap', rules)).toBe(51)); // 40*1.25+1
  it('first apron: 100%', () => expect(maxIncomingSalary(20, 'first_apron', rules)).toBe(20));
  it('second apron: 100%', () => expect(maxIncomingSalary(20, 'second_apron', rules)).toBe(20));
});
