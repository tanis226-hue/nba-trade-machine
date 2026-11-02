import type { Rule, TradeFinding, TradeAsset } from '../types';
import { fmt } from '../format';

function cashValue(a: TradeAsset): number {
  return a.amount ?? a.salary ?? 0;
}

/**
 * Cash-in-trade limits. Each team may neither SEND nor RECEIVE more than the annual
 * cash limit across a single season; the two directions are tracked separately.
 */
export const cashRule: Rule = (ctx) => {
  const limit = ctx.rules?.cashLimit ?? ctx.season.salaryCap * 0.0515;
  const findings: TradeFinding[] = [];
  const citation = '2023 CBA Art. VII, §8(a) — 5.15% of the salary cap (separate send/receive)';

  for (const team of ctx.teams) {
    const cashAssets = ctx.assets.filter((a) => a.kind === 'cash');

    const cashSent = cashAssets
      .filter((a) => a.fromTeam === team.abbr)
      .reduce((sum, a) => sum + cashValue(a), 0);

    const cashReceived = cashAssets
      .filter((a) => a.toTeam === team.abbr)
      .reduce((sum, a) => sum + cashValue(a), 0);

    if (cashSent > limit) {
      findings.push({
        code: 'CASH_OVER_LIMIT',
        severity: 'block',
        teamAbbr: team.abbr,
        message: `${team.abbr} is sending ${fmt(cashSent)} in cash, exceeding the ${fmt(limit)} annual limit.`,
        citation,
        fix: `Reduce cash sent by ${fmt(cashSent - limit)} to ${fmt(limit)} or less, or shift value to another asset type.`,
      });
    }

    if (cashReceived > limit) {
      findings.push({
        code: 'CASH_OVER_LIMIT',
        severity: 'block',
        teamAbbr: team.abbr,
        message: `${team.abbr} is receiving ${fmt(cashReceived)} in cash, exceeding the ${fmt(limit)} annual limit.`,
        citation,
        fix: `Reduce cash received by ${fmt(cashReceived - limit)} to ${fmt(limit)} or less, or shift value to another asset type.`,
      });
    }
  }

  return findings;
};
