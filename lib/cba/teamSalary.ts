import type { SeasonCap, ApronTier } from './types';
import { tierFor } from './tier';

export interface TeamSalary {
  capSalary: number; // total cap allocations (contracts + dead money + cap holds + roster charges)
  apronSalary: number; // apron-basis payroll (adds unlikely incentives; ≈ capSalary until that data lands)
  tier: ApronTier;
  capSpace: number; // salaryCap - capSalary (negative when over the cap)
  taxSpace: number; // taxLine - capSalary
  firstApronSpace: number; // firstApron - apronSalary
  secondApronSpace: number; // secondApron - apronSalary
}

export interface TeamSalaryOpts {
  apronHits?: number[]; // per-player apron-basis hits (defaults to capHits)
  deadMoney?: number; // waived-player cap charges (count toward salary, not tradeable)
  capHolds?: number; // sum of non-renounced cap holds
  rosterCharges?: number; // incomplete-roster charges for under-cap teams
}

/**
 * Compute a team's cap- and apron-basis salary and its distance to each CBA line from the
 * current-season cap hits of its roster. Pure; the engine's matching/apron rules consume the
 * resulting numbers (capSalary as preTradeSalary, apronSalary, capSpace).
 */
export function computeTeamSalary(capHits: number[], cap: SeasonCap, opts: TeamSalaryOpts = {}): TeamSalary {
  const base = capHits.reduce((s, n) => s + n, 0);
  const capSalary = base + (opts.deadMoney ?? 0) + (opts.capHolds ?? 0) + (opts.rosterCharges ?? 0);
  const apronBase = (opts.apronHits ?? capHits).reduce((s, n) => s + n, 0);
  const apronSalary = apronBase + (opts.deadMoney ?? 0) + (opts.capHolds ?? 0) + (opts.rosterCharges ?? 0);
  return {
    capSalary,
    apronSalary,
    tier: tierFor(capSalary, cap),
    capSpace: cap.salaryCap - capSalary,
    taxSpace: cap.taxLine - capSalary,
    firstApronSpace: cap.firstApron - apronSalary,
    secondApronSpace: cap.secondApron - apronSalary,
  };
}
