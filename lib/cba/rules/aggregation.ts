import type { Rule, TradeFinding } from '../types';
import { restrictionsFor } from '../apron';

/**
 * Second-apron aggregation prohibition: a team at/above the second apron may not aggregate
 * two or more outgoing player salaries in a single trade.
 * 2023 CBA Art. VII — second-apron team restrictions.
 */
export const aggregationRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  for (const t of ctx.teams) {
    if (t.outgoing === 0 && t.incoming === 0) continue;
    const restr = restrictionsFor(t.preTier, ctx.apron);
    if (t.playersOut >= 2 && !restr.canAggregate) {
      out.push({
        code: 'NO_AGGREGATION',
        severity: 'block',
        teamAbbr: t.abbr,
        message: `${t.abbr} are above the second apron and cannot aggregate salaries in a trade.`,
        citation: '2023 CBA Art. VII — second-apron team may not aggregate outgoing salaries.',
        fix: `Send a single player out, or stay below the second apron before the deal.`,
      });
    }
  }
  return out;
};
