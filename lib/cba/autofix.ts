import type { TradeInput } from './types';
import { buildContext, evaluate } from './engine';
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
 * Search bounded combinations of removals, preferring fewer changed routes. Every returned plan
 * passes the full engine and preserves a nonempty deal. An exhausted search returns no proposal.
 */
export function planAutoFix(input: TradeInput): FixAction[] {
  if(evaluate(input).valid) return [];
  const moved=input.assets.filter(a=>a.fromTeam!==a.toTeam).sort((a,b)=>b.salary-a.salary||a.id.localeCompare(b.id));
  if(moved.length>24) return [];
  let frontier:number[][]=[[]]; let checked=0;
  for(let depth=1;depth<=3;depth++) {
    const next:number[][]=[];
    for(const chosen of frontier) for(let i=(chosen.at(-1)??-1)+1;i<moved.length;i++) {
      const candidate=[...chosen,i]; if(candidate.length>=moved.length) continue;
      const ids=new Set(candidate.map(n=>moved[n].id));
      const assets=input.assets.map(a=>ids.has(a.id)?{...a,toTeam:a.fromTeam}:a);
      if(evaluate({...input,assets}).valid) return candidate.map(n=>({assetId:moved[n].id,toTeam:moved[n].fromTeam,label:`Keep ${moved[n].label} on ${moved[n].fromTeam}`}));
      if(++checked>=200) return [];
      next.push(candidate);
    }
    frontier=next;
  }
  return [];
}

/**
 * "Make this trade legal" — turn the blocking findings into concrete, quantified remedies.
 * Uses the validator's own matching quantities, including cap room, exceptions, and bonuses.
 * Suggestions require rechecking the entire deal; they are not guaranteed minimal changes.
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
        if (!e.matching) break;
        const { incoming, limit, shortfall } = e.matching;
        fixes.push({
          teamAbbr: t.abbr,
          text: `${t.abbr}: reduce matched incoming salary by ${fmt(shortfall)} (${fmt(incoming)} incoming, ${fmt(limit)} allowed). Adjust outgoing players or use an eligible exception, then recheck the whole deal.`,
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
