import { describe, it, expect } from 'vitest';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';

describe('constants', () => {
  it('cap landmarks strictly increasing', () => {
    const c = SEASON_2025_26;
    expect(c.salaryCap).toBeLessThan(c.taxLine);
    expect(c.taxLine).toBeLessThan(c.firstApron);
    expect(c.firstApron).toBeLessThan(c.secondApron);
  });
  it('matching brackets ordered, last is Infinity', () => {
    const b = MATCHING_2025_26.belowApron;
    expect(b[b.length - 1].upTo).toBe(Infinity);
  });
  it('second apron forbids aggregation', () => expect(APRON_2025_26.secondApron.canAggregate).toBe(false));
});
