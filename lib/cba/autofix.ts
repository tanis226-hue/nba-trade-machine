import type { TradeInput } from './types';
import { buildContext, evaluate } from './engine';
import { maxIncomingSalary } from './matching';
import { fmt } from './format';

export interface FixSuggestion {
  teamAbbr?: string;
  text: string;
}

/**
 * "Make this trade legal" — turn the blocking findings into concrete, quantified remedies.
 * No competitor offers this. Pure: runs the engine, then for each block computes the exact
 * delta and the cheapest way to close it (send more out, take less back, use a TPE/cap space,
 * switch to non-simultaneous, or split the deal).
 */
export function suggestFixes(input: TradeInput): FixSuggestion[] {
  const res = evaluate(input);
  if (res.valid) return [];
  const ctx = buildContext(input);
  const byAbbr = Object.fromEntries(ctx.teams.map((t) => [t.abbr, t]));
  const fixes: FixSuggestion[] = [];

  for (const e of res.errors) {
    const t = e.teamAbbr ? byAbbr[e.teamAbbr] : undefined;
    switch (e.code) {
      case 'OVER_MATCH': {
        if (!t) break;
        const limit =
          input.tradeMethod === 'non_simultaneous'
            ? t.outgoing + 250_000
            : maxIncomingSalary(t.outgoing, t.preTier, input.matching);
        const over = Math.max(0, t.incoming - limit);
        const tail = input.tradeMethod !== 'non_simultaneous' ? ', or switch to a non-simultaneous trade' : '';
        fixes.push({
          teamAbbr: t.abbr,
          text: `${t.abbr}: take back ${fmt(over)} less, send ${fmt(over)} more out, or route a ${fmt(over)} contract into cap space / a TPE${tail}.`,
        });
        break;
      }
      case 'NO_AGGREGATION':
        fixes.push({
          teamAbbr: e.teamAbbr,
          text: `${e.teamAbbr}: a second-apron team can't aggregate — send only ONE player out (currently ${t?.playersOut ?? '2+'}), or split this into separate trades.`,
        });
        break;
      case 'HARD_CAP_EXCEEDED':
      case 'HARD_CAP_ST':
        fixes.push({
          teamAbbr: e.teamAbbr,
          text: `${e.teamAbbr}: would cross a hard cap — take back less or send more out to stay under it.`,
        });
        break;
      case 'ROSTER_OVER':
        fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr}: include another outgoing player or waive one to stay at 15.` });
        break;
      case 'ST_OVER_APRON':
        fixes.push({
          teamAbbr: e.teamAbbr,
          text: `${e.teamAbbr}: can't acquire via sign-and-trade while over the first apron — acquire by standard trade or get under the apron first.`,
        });
        break;
      case 'ST_SHORT_TERM':
        fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr}: a sign-and-trade contract must be 3-4 years.` });
        break;
      case 'CASH_OVER_LIMIT':
        fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr}: reduce cash in the deal to within the annual limit.` });
        break;
      case 'PICK_TOO_FAR':
        fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr}: that pick is more than 7 drafts out — trade a nearer pick.` });
        break;
      case 'STEPIEN_VIOLATION':
        fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr}: keep a first in each consecutive year (Stepien) — protect or swap instead of trading outright.` });
        break;
      default:
        if (e.fix) fixes.push({ teamAbbr: e.teamAbbr, text: `${e.teamAbbr ? `${e.teamAbbr}: ` : ''}${e.fix}` });
    }
  }
  return fixes;
}
