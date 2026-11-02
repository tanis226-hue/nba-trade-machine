import { describe, it, expect } from 'vitest';
import caps from '@/data/overrides/season_cap.json';
import {
  CBA_BASE_CAP, SEASON_RULES_2025_26, SEASON_RULES_2026_27, taxBracketsForCap,
} from '../constants';
import { maxIncomingSalary } from '../matching';
import { taxBill } from '../rules/tax';

// Independent fixtures from NBA cap releases and 2023 CBA Art. VII §§2(d), 6(j), 8(a).
describe('official season rules', () => {
  it('uses the announced 2026-27 landmarks and deadline', () => {
    expect(SEASON_RULES_2026_27.cap).toEqual({
      season: '2026-27', salaryCap: 164_961_000, taxLine: 200_428_000,
      firstApron: 209_015_000, secondApron: 221_686_000, minTeamSalary: 148_465_000,
    });
    expect(SEASON_RULES_2026_27.calendar?.tradeDeadline).toBe('2027-02-11');
    expect(SEASON_RULES_2026_27.cashLimit).toBeCloseTo(8_495_491.5, 2);
  });

  for (const rules of [SEASON_RULES_2025_26, SEASON_RULES_2026_27]) {
    const season = rules.cap.season;
    it(`${season}: import data agrees with the engine`, () => {
      const row = caps.find((c) => c.season === season)!;
      expect(row).toEqual({
        season, salary_cap: rules.cap.salaryCap, tax_line: rules.cap.taxLine,
        first_apron: rules.cap.firstApron, second_apron: rules.cap.secondApron,
        min_team_salary: rules.cap.minTeamSalary,
      });
    });

    it(`${season}: matching agrees with the CBA formula around both breakpoints`, () => {
      const allowance = 7_500_000 * rules.cap.salaryCap / 136_021_000;
      const low = allowance - 250_000;
      const high = 4 * low;
      for (const outgoing of [0, 1_000_000, low - 1, low, low + 1, 20_000_000, high - 1, high, high + 1, 60_000_000]) {
        const expected = Math.max(
          Math.min(2 * outgoing + 250_000, outgoing + allowance),
          1.25 * outgoing + 250_000,
        );
        expect(maxIncomingSalary(outgoing, 'over_cap', rules.matching)).toBeCloseTo(expected, 4);
        expect(maxIncomingSalary(outgoing, 'first_apron', rules.matching)).toBe(outgoing);
        expect(maxIncomingSalary(outgoing, 'second_apron', rules.matching)).toBe(outgoing);
      }
    });
  }
});

describe('tax schedule effective from 2025-26', () => {
  it('matches the CBA worked example: $6M bands, $15M over, non-repeater = $24M', () => {
    expect(taxBill(15_000_000, taxBracketsForCap(CBA_BASE_CAP * 1.2), false)).toBeCloseTo(24_000_000, 2);
  });

  it('matches the CBA worked example: $6.5M bands, $15M over, repeater = $51.625M', () => {
    expect(taxBill(15_000_000, taxBracketsForCap(CBA_BASE_CAP * 1.3), true)).toBeCloseTo(51_625_000, 2);
  });

  it('keeps escalating after the fifth band instead of capping the marginal rate', () => {
    const brackets = taxBracketsForCap(CBA_BASE_CAP);
    // Six $5M bands at 1, 1.25, 3.5, 4.75, 5.25, 5.75.
    expect(taxBill(30_000_000, brackets, false)).toBe(107_500_000);
    expect(taxBill(31_000_000, brackets, false)).toBe(113_750_000);
    expect(taxBill(31_000_000, brackets, true)).toBe(175_750_000);
    expect(taxBill(0, brackets, false)).toBe(0);
  });
});
