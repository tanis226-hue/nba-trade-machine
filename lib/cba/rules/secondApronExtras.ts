import type { Rule, TradeFinding } from '../types';

/**
 * Second-apron extra restrictions (beyond the aggregation prohibition, which lives in a
 * separate rule). Cash sending is evaluated by the post-transaction hard-cap rule.
 * For a team at/above the second apron pre-trade, it may not use a Traded Player
 * Exception that was created from a prior sign-and-trade
 *       to absorb incoming salary.
 * 2023 CBA Art. VII — second-apron team restrictions.
 */
export const secondApronExtrasRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];

  for (const t of ctx.teams) {
    if (t.preTier !== 'second_apron') continue;

    // (2) No absorbing incoming salary via a sign-and-trade-created exception.
    // Model: the team is receiving players while it holds a TPE flagged createdFromSignAndTrade.
    const hasStException = (t.exceptions ?? []).some(
      (e) => e.createdFromSignAndTrade === true,
    );
    const absorbsIncoming = t.incomingAssets.some((a) => a.kind === 'player');
    if (hasStException && absorbsIncoming) {
      out.push({
        code: 'SECOND_APRON_ST_TPE',
        severity: 'block',
        teamAbbr: t.abbr,
        // VERIFY: modeled as "holds a sign-and-trade TPE while absorbing incoming players."
        // The CBA bars a second-apron team from using a sign-and-trade-generated exception; the
        // sparse asset data here can't bind a specific incoming player to a specific exception.
        message: `${t.abbr} are above the second apron and cannot use a sign-and-trade-created exception to absorb salary.`,
        citation: '2023 CBA Art. VII — second-apron team may not use a sign-and-trade-created TPE to acquire players.',
        fix: `Acquire the incoming salary into cap space or a standard exception, or get below the second apron first.`,
      });
    }
  }

  return out;
};
