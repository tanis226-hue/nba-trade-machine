import type { Rule, TradeFinding, TradeAsset } from '../types';
import { fmt } from '../format';

// VERIFY: 2025-26 annual cash-in-trade limit is ~$7.97M; default below is the conservative
// $7.5M floor used elsewhere in the engine. Real value should come from ctx.rules.cashLimit.
const DEFAULT_CASH_LIMIT = 7_500_000;

function cashValue(a: TradeAsset): number {
  return a.amount ?? a.salary ?? 0;
}

/**
 * Cash-in-trade limits. Each team may neither SEND nor RECEIVE more than the annual
 * cash limit across a single season; the two directions are tracked separately.
 */
export const cashRule: Rule = (ctx) => {
  const limit = ctx.rules?.cashLimit ?? DEFAULT_CASH_LIMIT;
  const findings: TradeFinding[] = [];
  const citation = '2023 CBA Art. VII, §4 — annual cash-in-trade limit (separate send/receive)';

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
