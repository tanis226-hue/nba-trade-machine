/**
 * Waive-and-stretch + set-off (team-salary mechanics that feed apron/tax positions, not trade
 * legality directly). A waived player's remaining GUARANTEED salary is charged to the cap over
 * 2 × (remaining contract years) + 1 seasons. The dead money charged in any one season may not
 * exceed 15% of that season's salary cap (the stretch limit). Set-off reduces the waiving team's
 * obligation by one-half of the player's new contract above the one-year minimum.
 * 2023 CBA Art. VII §4 — waiver, stretch, and set-off.
 */

export interface StretchResult {
  years: number; // seasons the dead money is spread across
  perSeason: number; // dead-money cap charge per season
  exceedsLimit: boolean; // perSeason exceeds 15% of the cap
}

export function waiveAndStretch(remainingGuaranteed: number, remainingYears: number, salaryCap: number): StretchResult {
  const years = Math.max(1, 2 * Math.max(0, remainingYears) + 1);
  const perSeason = remainingGuaranteed / years;
  return { years, perSeason, exceedsLimit: perSeason > 0.15 * salaryCap };
}

/** Set-off: half of the player's new contract above the one-year minimum reduces the dead money. */
export function setOff(newContractTotal: number, oneYearMinimum: number): number {
  return Math.max(0, (newContractTotal - oneYearMinimum) / 2);
}
