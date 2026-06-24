import type { Rule, TradeFinding, TradeAsset } from '../types';

/**
 * Sign-and-trade legality. For each team RECEIVING a player signed via sign-and-trade:
 *   (1) a team whose preTier is at/above the first apron cannot acquire a player by S&T.
 *   (2) the incoming S&T contract must run 3-4 years; a contract shorter than 3 years is illegal.
 *
 * 2023 CBA Art. VII — sign-and-trade transactions hard-cap the acquiring team at the first
 * apron (so a team already over the first apron cannot acquire via S&T) and require the new
 * contract to be 3 to 4 seasons in length.
 */
export const signAndTradeRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];

  for (const t of ctx.teams) {
    const overFirstApron = t.preTier === 'first_apron' || t.preTier === 'second_apron';

    for (const a of t.incomingAssets) {
      if (a.kind !== 'player') continue;
      if (a.signedVia !== 'sign_and_trade') continue;

      if (overFirstApron) {
        out.push({
          code: 'ST_OVER_APRON',
          severity: 'block',
          teamAbbr: t.abbr,
          message: `${t.abbr} are over the first apron and cannot acquire ${a.label} via sign-and-trade.`,
          citation:
            '2023 CBA Art. VII — sign-and-trade hard-caps the acquiring team at the first apron; a team over the first apron cannot acquire a player by sign-and-trade.',
          fix: `Get ${t.abbr} below the first apron before the deal, or acquire ${a.label} through a different mechanism.`,
        });
      }

      const years = contractYears(a);
      if (years !== undefined && years < 3) {
        out.push({
          code: 'ST_SHORT_TERM',
          severity: 'block',
          teamAbbr: t.abbr,
          message: `${a.label} is a ${years}-year sign-and-trade contract; sign-and-trade deals must be 3 to 4 years.`,
          citation:
            '2023 CBA Art. VII — a sign-and-trade contract must be at least 3 and no more than 4 seasons in length.',
          fix: `Extend ${a.label}'s new contract to at least 3 seasons, or restructure as a non-sign-and-trade acquisition.`,
        });
      } else if (years !== undefined && years > 4) {
        out.push({
          code: 'ST_LONG_TERM',
          severity: 'block',
          teamAbbr: t.abbr,
          message: `${a.label} is a ${years}-year sign-and-trade contract; sign-and-trade deals are capped at 4 years.`,
          citation:
            '2023 CBA Art. VII — a sign-and-trade contract may be no more than 4 seasons in length.',
          fix: `Shorten ${a.label}'s new contract to 4 seasons or fewer, or restructure as a non-sign-and-trade acquisition.`,
        });
      }
    }
  }

  return out;
};

/**
 * Total contract length = the current season (1) plus each future season listed.
 * Returns undefined when length cannot be determined (no futureSalaries field) so the
 * rule no-ops on the length check rather than guessing.
 */
function contractYears(a: TradeAsset): number | undefined {
  if (a.futureSalaries === undefined) return undefined;
  return 1 + a.futureSalaries.length;
}
