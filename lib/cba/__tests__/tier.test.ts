import { describe, it, expect } from 'vitest';
import { tierFor, tierForTeam } from '@/lib/cba/tier';
import type { SeasonCap } from '@/lib/cba/types';

const cap: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };

describe('tierFor', () => {
  it('below cap', () => expect(tierFor(90, cap)).toBe('below_cap'));
  it('over cap', () => expect(tierFor(120, cap)).toBe('over_cap'));
  it('over tax', () => expect(tierFor(145, cap)).toBe('over_tax'));
  it('first apron boundary', () => expect(tierFor(150, cap)).toBe('first_apron'));
  it('second apron boundary', () => expect(tierFor(160, cap)).toBe('second_apron'));
  it('uses apron salary for apron restrictions even when the cap hit is lower',()=>{
    expect(tierForTeam(145,151,cap)).toBe('first_apron');
    expect(tierForTeam(145,161,cap)).toBe('second_apron');
    expect(tierForTeam(145,149,cap)).toBe('over_tax');
  });
});
