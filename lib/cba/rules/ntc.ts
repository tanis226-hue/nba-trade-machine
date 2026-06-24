import type { Rule, TradeFinding } from '../types';

/**
 * No-trade-clause consent.
 *
 * For each team, every OUTGOING player asset carrying an explicit no-trade
 * clause (noTradeClause) or an implied veto (impliedNtc — a one-year Bird
 * re-sign, or a one-year deal with an option, which the CBA auto-grants a
 * veto right) requires the player's consent before the trade can proceed.
 *
 * Legal but conditional: severity is `warning`, not `block`.
 *
 * 2023 CBA Art. VII (No-Trade Clauses / one-year-veto right).
 */
export const ntcRule: Rule = (ctx): TradeFinding[] => {
  const findings: TradeFinding[] = [];

  for (const team of ctx.teams) {
    for (const asset of team.outgoingAssets) {
      if (asset.kind !== 'player') continue;
      if (!asset.noTradeClause && !asset.impliedNtc) continue;

      const implied = !asset.noTradeClause && asset.impliedNtc;
      findings.push({
        code: 'NTC_CONSENT',
        severity: 'warning',
        teamAbbr: team.abbr,
        message: implied
          ? `${asset.label} has an implied no-trade right (one-year Bird re-sign or one-year-plus-option) and must consent to this trade.`
          : `${asset.label} has a no-trade clause and must consent to this trade.`,
        citation: '2023 CBA Art. VII — no-trade clauses / one-year-veto right',
        fix: 'Obtain the player’s written consent to the trade before it can be processed.',
      });
    }
  }

  return findings;
};
