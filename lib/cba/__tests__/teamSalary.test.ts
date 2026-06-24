import { describe, it, expect } from 'vitest';
import { computeTeamSalary } from '../teamSalary';
import { SEASON_2025_26 } from '../constants';

const cap = SEASON_2025_26;

describe('computeTeamSalary', () => {
  it('sums cap hits and derives distances to each line', () => {
    const r = computeTeamSalary([50_000_000, 40_000_000, 30_000_000], cap); // 120M, below cap
    expect(r.capSalary).toBe(120_000_000);
    expect(r.tier).toBe('below_cap');
    expect(r.capSpace).toBe(cap.salaryCap - 120_000_000);
    expect(r.firstApronSpace).toBe(cap.firstApron - 120_000_000);
    expect(r.secondApronSpace).toBeGreaterThan(0);
  });

  it('reports negative space when over a line', () => {
    const r = computeTeamSalary([200_000_000], cap); // over the first apron
    expect(r.tier).toBe('first_apron');
    expect(r.firstApronSpace).toBeLessThan(0); // over the first apron
    expect(r.secondApronSpace).toBeGreaterThan(0); // still under the second
  });

  it('adds dead money and cap holds to cap salary', () => {
    const r = computeTeamSalary([100_000_000], cap, { deadMoney: 5_000_000, capHolds: 10_000_000 });
    expect(r.capSalary).toBe(115_000_000);
  });

  it('apron salary can diverge from cap salary via apronHits', () => {
    const r = computeTeamSalary([100_000_000], cap, { apronHits: [108_000_000] });
    expect(r.capSalary).toBe(100_000_000);
    expect(r.apronSalary).toBe(108_000_000);
    expect(r.firstApronSpace).toBe(cap.firstApron - 108_000_000);
  });
});
