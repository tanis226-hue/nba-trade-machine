import { describe, it, expect } from 'vitest';
import { pickValue } from '@/lib/cba/pickValue';
import type { PickProtection } from '@/lib/cba/types';

const unprotected: PickProtection = { type: 'unprotected' };
const top10: PickProtection = { type: 'top', through: 10 };

describe('pickValue (rich model)', () => {
  it('a high lottery pick is worth more than a late first', () => {
    expect(pickValue({ round: 1, projectedSlot: 2 })).toBeGreaterThan(pickValue({ round: 1, projectedSlot: 28 }));
  });

  it('an unprotected pick is worth more than the same pick top-10 protected', () => {
    const slot = 8;
    expect(pickValue({ round: 1, projectedSlot: slot, protection: unprotected })).toBeGreaterThan(
      pickValue({ round: 1, projectedSlot: slot, protection: top10 }),
    );
  });

  it("a tanking team's pick (low win%) is worth more than a contender's", () => {
    expect(pickValue({ round: 1, ownerWinPct: 0.2 })).toBeGreaterThan(pickValue({ round: 1, ownerWinPct: 0.75 }));
  });

  it('a first is worth more than a second at the equivalent position', () => {
    expect(pickValue({ round: 1, projectedSlot: 25 })).toBeGreaterThan(pickValue({ round: 2, projectedSlot: 25 }));
  });

  it('a nearer pick is worth at least as much as the same pick further out', () => {
    const near = pickValue({ round: 1, projectedSlot: 12, yearsOut: 0 });
    const far = pickValue({ round: 1, projectedSlot: 12, yearsOut: 5 });
    expect(near).toBeGreaterThanOrEqual(far);
    expect(far).toBeGreaterThan(0);
  });

  it('value decreases monotonically as the slot worsens', () => {
    const slots = [1, 5, 10, 20, 30, 45, 60];
    const vals = slots.map((s) => pickValue({ round: s <= 30 ? 1 : 2, projectedSlot: s }));
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeLessThan(vals[i - 1]);
  });

  it('falls back to a round midpoint when given neither slot nor win%', () => {
    expect(pickValue({ round: 1 })).toBeGreaterThan(pickValue({ round: 2 }));
    expect(pickValue({ round: 1 })).toBeGreaterThan(0);
  });

  it('keeps the legacy positional signature working for the grader', () => {
    expect(pickValue(1)).toBeGreaterThan(pickValue(2));
    expect(pickValue(1, 2027)).toBeLessThanOrEqual(pickValue(1, 2026));
    expect(typeof pickValue(1, 2030)).toBe('number');
  });
});
