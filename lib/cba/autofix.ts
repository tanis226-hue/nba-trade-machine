import type { TradeInput } from './types';
import { buildContext, evaluate } from './engine';
import { maxIncomingSalary } from './matching';
import { fmt } from './format';

export interface FixSuggestion {
  teamAbbr?: string;
  text: string;
}

/** A concrete mutation the one-click fixer applies: route `assetId` to `toTeam` (Stay = its origin). */
export interface FixAction {
  assetId: string;
  toTeam: string;
  label: string; // human description, e.g. "remove B. Adebayo from the deal"
}

/**
 * Compute a minimal set of routing changes that make the trade legal, by greedily simplifying the
 * deal: drop a too-much-takeback team's smallest incoming player (OVER_MATCH / hard cap), and
 * un-aggregate a second-apron team down to one outgoing player (NO_AGGREGATION). Returns the actions
 * (empty if already legal or not auto-fixable). Pure — the caller applies them to the store.
 */
export function planAutoFix(input: TradeInput): FixAction[] {
  let assets = input.assets.map((a) => ({ ...a }));
  const actions: FixAction[] = [];
  const sendBack = (id: string, fromTeam: string, label: string) => {
    assets = assets.map((a) => (a.id === id ? { ...a, toTeam: a.fromTeam } : a));
    actions.push({ assetId: id, toTeam: fromTeam, label });
  };

  for (let iter = 0; iter < 60; iter++) {
    const res = evaluate({ ...input, assets });
    if (res.valid) break;
    const ctx = buildContext({ ...input, assets });
    const find = (code: string) => res.errors.find((e) => e.code === code);

    const overMatch = find('OVER_MATCH') || find('HARD_CAP_EXCEEDED') || find('HARD_CAP_ST');
    if (overMatch?.teamAbbr) {
      const t = ctx.teams.find((x) => x.abbr === overMatch.teamAbbr);
      const smallest = t?.incomingAssets
        .filter((a) => a.kind === 'player')
        .sort((a, b) => a.salary - b.salary)[0];
      if (smallest) {
        sendBack(smallest.id, smallest.fromTeam, `Keep ${smallest.label} on ${smallest.fromTeam} (drop from the deal)`);
        continue;
      }
    }

    const noAgg = find('NO_AGGREGATION');
    if (noAgg?.teamAbbr) {
      const t = ctx.teams.find((x) => x.abbr === noAgg.teamAbbr);
      const out = (t?.outgoingAssets ?? [])
        .filter((a) => a.kind === 'player')
        .sort((a, b) => b.salary - a.salary); // keep the largest, drop the rest
      let removed = false;
      for (const a of out.slice(1)) {
        sendBack(a.id, a.fromTeam, `Keep ${a.label} on ${a.fromTeam} (second-apron team can't aggregate)`);
        removed = true;
      }
      if (removed) continue;
    }

    break; // remaining blocks aren't auto-fixable by simplification
  }
  return actions;
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
