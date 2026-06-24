import type { Rule, TradeFinding, TaxBracket } from '../types';
import { fmt } from '../format';

/**
 * Luxury-tax bill (INFO only, never blocks).
 *
 * Walks the escalating tax brackets over the amount a team is above the tax
 * line, using the repeater multiplier for repeater taxpayers. Brackets are
 * marginal: each bracket's rate applies only to the slice of overage that
 * falls within it. Computed/settled at season end, so this is informational.
 *
 * 2023 CBA Art. VII — luxury tax, escalating brackets + repeater rate.
 */
export const taxRule: Rule = (ctx) => {
  const brackets = ctx.rules?.taxBrackets;
  if (!brackets || brackets.length === 0) return [];

  const taxLine = ctx.season.taxLine;
  if (typeof taxLine !== 'number') return [];

  const findings: TradeFinding[] = [];

  for (const team of ctx.teams) {
    const overage = team.postSalary - taxLine;
    if (overage <= 0) continue;

    const repeater = team.isRepeaterTaxpayer === true;
    const bill = taxBill(overage, brackets, repeater);
    if (bill <= 0) continue;

    findings.push({
      code: 'TAX_BILL',
      severity: 'info',
      teamAbbr: team.abbr,
      message: `${team.abbr} projected luxury tax: ${fmt(bill)}${repeater ? ' (repeater)' : ''}`,
      citation: '2023 CBA Art. VII — luxury tax, escalating brackets + repeater. Computed at season end.',
    });
  }

  return findings;
};

function taxBill(overage: number, brackets: TaxBracket[], repeater: boolean): number {
  let remaining = overage;
  let prevCap = 0;
  let bill = 0;

  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.upTo - prevCap; // size of this marginal slice
    const slice = Math.min(remaining, width);
    const rate = repeater ? b.repeaterRate : b.rate;
    bill += slice * rate;
    remaining -= slice;
    prevCap = b.upTo;
  }

  return bill;
}
