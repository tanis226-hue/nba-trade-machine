import { describe, it, expect } from 'vitest';
import { resolveSwap, parseSwapNote } from '@/lib/cba/pickSwaps';
import type { SwapInput } from '@/lib/cba/pickSwaps';

describe('resolveSwap', () => {
  it('most favorable picks the lowest slot (two teams)', () => {
    const r = resolveSwap({ kind: 'most_favorable', slots: [{ team: 'IND', slot: 8 }, { team: 'WAS', slot: 3 }] });
    expect(r.team).toBe('WAS');
    expect(r.slot).toBe(3);
    expect(r.reason).toContain('most favorable');
  });

  it('least favorable picks the highest slot (two teams)', () => {
    const r = resolveSwap({ kind: 'least_favorable', slots: [{ team: 'IND', slot: 8 }, { team: 'WAS', slot: 3 }] });
    expect(r.team).toBe('IND');
    expect(r.slot).toBe(8);
  });

  it('most favorable across three teams', () => {
    const r = resolveSwap({ kind: 'most_favorable', slots: [{ team: 'CLE', slot: 20 }, { team: 'MIN', slot: 5 }, { team: 'UTA', slot: 12 }] });
    expect(r.team).toBe('MIN');
    expect(r.slot).toBe(5);
  });

  it('least favorable across three teams', () => {
    const r = resolveSwap({ kind: 'least_favorable', slots: [{ team: 'CLE', slot: 20 }, { team: 'MIN', slot: 5 }, { team: 'UTA', slot: 12 }] });
    expect(r.team).toBe('CLE');
    expect(r.slot).toBe(20);
  });

  it('nth favorable (2nd) takes the middle slot ascending', () => {
    const r = resolveSwap({ kind: 'nth_favorable', nth: 2, slots: [{ team: 'CLE', slot: 20 }, { team: 'MIN', slot: 5 }, { team: 'UTA', slot: 12 }] });
    expect(r.team).toBe('UTA');
    expect(r.slot).toBe(12);
  });

  it('nth favorable (3rd of three) equals least favorable', () => {
    const slots = [{ team: 'CLE', slot: 20 }, { team: 'MIN', slot: 5 }, { team: 'UTA', slot: 12 }];
    expect(resolveSwap({ kind: 'nth_favorable', nth: 3, slots })).toMatchObject({ team: 'CLE', slot: 20 });
  });

  it('breaks ties deterministically: first-listed wins on most favorable', () => {
    const r = resolveSwap({ kind: 'most_favorable', slots: [{ team: 'IND', slot: 7 }, { team: 'WAS', slot: 7 }] });
    expect(r.team).toBe('IND');
  });

  it('breaks ties deterministically: first-listed wins on least favorable', () => {
    const r = resolveSwap({ kind: 'least_favorable', slots: [{ team: 'IND', slot: 7 }, { team: 'WAS', slot: 7 }] });
    expect(r.team).toBe('IND');
  });

  it('single-slot swap returns that slot', () => {
    expect(resolveSwap({ kind: 'most_favorable', slots: [{ team: 'BOS', slot: 14 }] })).toMatchObject({ team: 'BOS', slot: 14 });
  });

  it('nth defaults to 1 (most favorable) when omitted', () => {
    const r = resolveSwap({ kind: 'nth_favorable', slots: [{ team: 'IND', slot: 8 }, { team: 'WAS', slot: 3 }] } as SwapInput);
    expect(r).toMatchObject({ team: 'WAS', slot: 3 });
  });

  it('throws on empty slots', () => {
    expect(() => resolveSwap({ kind: 'most_favorable', slots: [] })).toThrow();
  });

  it('throws on out-of-range nth', () => {
    expect(() => resolveSwap({ kind: 'nth_favorable', nth: 4, slots: [{ team: 'A', slot: 1 }, { team: 'B', slot: 2 }] })).toThrow();
  });
});

describe('parseSwapNote', () => {
  it("parses 'most favorable'", () => {
    expect(parseSwapNote('most favorable')).toEqual({ kind: 'most_favorable' });
  });

  it("parses 'least favorable'", () => {
    expect(parseSwapNote('least favorable')).toEqual({ kind: 'least_favorable' });
  });

  it("parses '2nd-most favorable' as nth=2", () => {
    expect(parseSwapNote('2nd-most favorable')).toEqual({ kind: 'nth_favorable', nth: 2 });
  });

  it("parses 'less favorable of IND/WAS' as least favorable", () => {
    expect(parseSwapNote('less favorable of IND/WAS')).toEqual({ kind: 'least_favorable' });
  });

  it("parses 'least favorable of CLE/MIN/UTA' as least favorable", () => {
    expect(parseSwapNote('least favorable of CLE/MIN/UTA')).toEqual({ kind: 'least_favorable' });
  });

  it("parses 'more favorable of A/B' as most favorable", () => {
    expect(parseSwapNote('more favorable of A/B')).toEqual({ kind: 'most_favorable' });
  });

  it("parses 'second most favorable' (word form) as nth=2", () => {
    expect(parseSwapNote('second most favorable')).toEqual({ kind: 'nth_favorable', nth: 2 });
  });

  it("returns null for a non-swap note 'top-4'", () => {
    expect(parseSwapNote('top-4')).toBeNull();
  });

  it('returns null for unprotected / empty protections', () => {
    expect(parseSwapNote('unprotected')).toBeNull();
    expect(parseSwapNote('top-10 then 2nds')).toBeNull();
  });
});

describe('parse then resolve (end to end)', () => {
  it("resolves the slot a 'less favorable of IND/WAS' note describes", () => {
    const parsed = parseSwapNote('less favorable of IND/WAS');
    expect(parsed).not.toBeNull();
    const r = resolveSwap({ ...parsed!, slots: [{ team: 'IND', slot: 8 }, { team: 'WAS', slot: 3 }] });
    expect(r).toMatchObject({ team: 'IND', slot: 8 });
  });
});
