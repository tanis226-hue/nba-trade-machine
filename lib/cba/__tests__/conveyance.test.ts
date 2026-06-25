import { describe, it, expect } from 'vitest';
import {
  resolveConveyance,
  resolveConveyanceSchedule,
} from '@/lib/cba/conveyance';
import type { PickProtection } from '@/lib/cba/types';

describe('resolveConveyance', () => {
  it('unprotected (or null) always conveys regardless of slot', () => {
    expect(resolveConveyance(null, 1)).toMatchObject({ conveys: true, outcome: 'unprotected_conveys' });
    expect(resolveConveyance(null, 30)).toMatchObject({ conveys: true, outcome: 'unprotected_conveys' });
    expect(resolveConveyance({ type: 'unprotected' }, 1)).toMatchObject({ conveys: true, outcome: 'unprotected_conveys' });
  });

  it('top-N protects at the boundary slot N and conveys at N+1', () => {
    const p: PickProtection = { type: 'top', through: 4 };
    // slot == N: protected
    expect(resolveConveyance(p, 4)).toMatchObject({ conveys: false, outcome: 'protected_rolls' });
    // slot == N+1: conveys
    expect(resolveConveyance(p, 5)).toMatchObject({ conveys: true, outcome: 'conveys' });
    // well inside protection
    expect(resolveConveyance(p, 1)).toMatchObject({ conveys: false, outcome: 'protected_rolls' });
    // well outside protection
    expect(resolveConveyance(p, 28)).toMatchObject({ conveys: true, outcome: 'conveys' });
  });

  it('top-1 is the tightest protection (only slot 1 protected)', () => {
    const p: PickProtection = { type: 'top', through: 1 };
    expect(resolveConveyance(p, 1).conveys).toBe(false);
    expect(resolveConveyance(p, 2).conveys).toBe(true);
  });

  it('range conveys only inside [a,b] inclusive', () => {
    const p: PickProtection = { type: 'range', range: [31, 55] };
    expect(resolveConveyance(p, 31)).toMatchObject({ conveys: true, outcome: 'conveys' }); // lower boundary
    expect(resolveConveyance(p, 55)).toMatchObject({ conveys: true, outcome: 'conveys' }); // upper boundary
    expect(resolveConveyance(p, 43).conveys).toBe(true); // middle
    expect(resolveConveyance(p, 30)).toMatchObject({ conveys: false, outcome: 'protected_rolls' }); // below
    expect(resolveConveyance(p, 56)).toMatchObject({ conveys: false, outcome: 'protected_rolls' }); // above
  });

  it('note-only protection (no structured type) conveys', () => {
    expect(resolveConveyance({ note: 'most favorable' }, 12).conveys).toBe(true);
  });
});

describe('resolveConveyanceSchedule', () => {
  it('conveys the first year it is unprotected at its slot', () => {
    const r = resolveConveyanceSchedule([
      { year: 2027, protection: { type: 'top', through: 4 }, projectedSlot: 3 }, // protected
      { year: 2028, protection: { type: 'top', through: 4 }, projectedSlot: 7 }, // conveys here
      { year: 2029, protection: { type: 'unprotected' }, projectedSlot: 1 },
    ]);
    expect(r.conveysInYear).toBe(2028);
    expect(r.finalOutcome).toBe('conveys');
  });

  it('conveys in the very first year when already unprotected at slot', () => {
    const r = resolveConveyanceSchedule([
      { year: 2027, protection: { type: 'top', through: 4 }, projectedSlot: 10 },
      { year: 2028, protection: { type: 'unprotected' }, projectedSlot: 1 },
    ]);
    expect(r.conveysInYear).toBe(2027);
    expect(r.finalOutcome).toBe('conveys');
  });

  it('rolls (no conveyance) when protected every year and no rollover-to-seconds', () => {
    const r = resolveConveyanceSchedule([
      { year: 2027, protection: { type: 'top', through: 10 }, projectedSlot: 5 },
      { year: 2028, protection: { type: 'top', through: 10 }, projectedSlot: 8 },
    ]);
    expect(r.conveysInYear).toBeNull();
    expect(r.finalOutcome).toBe('protected_rolls');
  });

  it('converts to seconds when never conveys and final year has rolloverToSecond', () => {
    const r = resolveConveyanceSchedule([
      { year: 2027, protection: { type: 'top', through: 10 }, projectedSlot: 4 },
      { year: 2028, protection: { type: 'top', through: 10, rolloverToSecond: true }, projectedSlot: 6 },
    ]);
    expect(r.conveysInYear).toBeNull();
    expect(r.finalOutcome).toBe('converts_to_seconds');
  });

  it('an empty schedule yields no conveyance', () => {
    const r = resolveConveyanceSchedule([]);
    expect(r.conveysInYear).toBeNull();
    expect(r.finalOutcome).toBe('protected_rolls');
  });

  it('a slot exactly at the boundary in a later year converts when it is the rollover year', () => {
    const r = resolveConveyanceSchedule([
      { year: 2030, protection: { type: 'top', through: 4 }, projectedSlot: 4, /* protected: slot==N */ },
      { year: 2031, protection: { type: 'top', through: 4, rolloverToSecond: true }, projectedSlot: 4 },
    ]);
    expect(r.conveysInYear).toBeNull();
    expect(r.finalOutcome).toBe('converts_to_seconds');
  });
});
