import type { Rule, TradeFinding } from '../types';
import { formatCash, hasValidCashAmount, isMovedCash } from '../cash';

const citation = '2023 CBA Art. VII, §8(a) — 5.15% of the salary cap; gross sent and received are separate annual allowances';

/** Annual allowances include prior trades. Neither receiving cash nor a pass-through
 * replenishes a sending allowance. Retained draft assets have no effect.
 */
export const cashRule: Rule = (ctx) => {
  const limit = ctx.rules?.cashLimit ?? ctx.season.salaryCap * 0.0515;
  const findings: TradeFinding[] = [];
  const movedCash = ctx.assets.filter(isMovedCash);
  for (const asset of movedCash) {
    if (!hasValidCashAmount(asset) || asset.salary !== 0) findings.push({
      code: 'INVALID_CASH_AMOUNT', severity: 'block', teamAbbr: asset.fromTeam,
      message: `${asset.label}: cash must have a positive whole-dollar amount and zero matching salary.`,
      fix: 'Enter a positive whole-dollar cash amount, or return/remove this cash asset.',
    });
  }
  const validCash = movedCash.filter(hasValidCashAmount);
  if (validCash.length === 0) return findings;

  const year = /^(20\d{2})-\d{2}$/.exec(ctx.season.season)?.[1];
  const capYearEnd = year ? `${Number(year) + 1}-06-30` : undefined;
  const date = ctx.simulatedDate?.slice(0, 10);
  if (date && year && capYearEnd && (date < `${year}-07-01` || date > capYearEnd)) findings.push({
    code: 'CASH_CAP_YEAR_MISMATCH', severity: 'conditional',
    message: `The trade date ${date} is outside the ${ctx.season.season} Salary Cap Year. Cash allowances and hard caps are checked for the selected season.`,
    citation,
    fix: 'Select the season containing the trade date, or correct the trade date and prior cash usage.',
  });

  for (const team of ctx.teams) {
    const usage = team.cashUsage;
    const usageMatches = usage?.season === ctx.season.season;
    for (const direction of ['sent', 'received'] as const) {
      const deal = validCash
        .filter((asset) => (direction === 'sent' ? asset.fromTeam : asset.toTeam) === team.abbr)
        .reduce((sum, asset) => sum + asset.amount!, 0);
      if (deal === 0) continue;
      const prior = usageMatches ? usage?.[direction] : undefined;
      if (prior != null && (!Number.isSafeInteger(prior) || prior < 0)) {
        findings.push({
          code: 'INVALID_CASH_USAGE', severity: 'block', teamAbbr: team.abbr,
          message: `${team.abbr} prior cash ${direction} must be a nonnegative whole-dollar amount for ${ctx.season.season}.`,
          fix: 'Correct the prior cash total or clear it to mark this allowance unknown.',
        });
        continue;
      }
      if (prior == null) findings.push({
        code: 'CASH_USAGE_UNKNOWN', severity: 'conditional', teamAbbr: team.abbr,
        message: `${team.abbr} prior cash ${direction} in ${ctx.season.season} is unknown${usage && !usageMatches ? ` (entered totals are for ${usage.season})` : ''}. This proposal ${direction === 'sent' ? 'sends' : 'receives'} ${formatCash(deal)}; the remaining annual allowance cannot be verified.`,
        citation,
        fix: `Enter ${team.abbr}'s gross cash ${direction} before this proposal for ${ctx.season.season}, including reimbursements, or confirm that total is $0.`,
      });
      const total = deal + (prior ?? 0);
      if (total > limit) findings.push({
        code: 'CASH_OVER_LIMIT', severity: 'block', teamAbbr: team.abbr,
        message: `${team.abbr} is ${direction === 'sent' ? 'sending' : 'receiving'} ${formatCash(deal)} in cash${prior == null ? '' : ` after ${formatCash(prior)} already ${direction}`}, exceeding the ${formatCash(limit)} annual ${direction} allowance by ${formatCash(total - limit)}.`,
        citation,
        fix: `Reduce cash ${direction} in this proposal to ${formatCash(Math.max(0, Math.floor(limit - (prior ?? 0))))} or less${prior == null ? ' and confirm the prior cash total' : ''}.`,
      });
    }

    const sendsCash = validCash.some((asset) => asset.fromTeam === team.abbr);
    const regularSeasonEnd = ctx.rules?.calendar?.regularSeasonEnd;
    if (sendsCash && date && regularSeasonEnd && capYearEnd && date > regularSeasonEnd && date <= capYearEnd) findings.push({
      code: 'CASH_NEXT_SEASON_APRON_UNKNOWN', severity: 'conditional', teamAbbr: team.abbr,
      message: `${team.abbr} sending cash after the regular season also constrains its next Salary Cap Year at the second apron. The required next-year apron payroll and option assumptions are not supplied.`,
      citation: '2023 CBA Art. VII, §2(e)(2)(ii)–(3), (4) row I — post-regular-season transactions and subsequent-year apron restrictions',
      fix: 'Verify next-year apron payroll under the CBA option assumptions and retain the subsequent-year second-apron hard cap before treating this proposal as cleared.',
    });
  }
  return findings;
};
