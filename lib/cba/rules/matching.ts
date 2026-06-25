import type { Rule, TradeFinding, TradeAsset, PerTeamContext, TeamException } from '../types';
import { maxIncomingSalary } from '../matching';
import { fmt } from '../format';

/**
 * Comprehensive traded-player salary matching. This is the one rule that must consider every
 * legalizing path, because additive rules cannot cancel each other's findings:
 *   - standard tiered band (below first apron) / 100% (at-or-above) — via maxIncomingSalary
 *   - cap-room absorption (a below-cap team absorbs into space, no matching on that portion)
 *   - TPE absorption (one incoming contract per exception, ≤ its amount, not aggregable)
 *   - minimum-salary exception (an over-cap team may always absorb a minimum contract)
 *   - non-simultaneous trade (band collapses to outgoing+$250k and GENERATES a TPE)
 *   - trade-bonus (kicker) folded into the receiving side's incoming, capped at the player max
 * 2023 CBA Art. VII §6.
 */
export const matchingRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  const nonSim = ctx.tradeMethod === 'non_simultaneous';

  for (const t of ctx.teams) {
    // Evaluate any team that takes salary IN — including a pure receiver (outgoing 0), since an
    // over-the-cap team can't absorb salary without sending matching salary out, cap space, or a TPE.
    if (t.incoming <= 0) continue;

    // 1) Peel off incoming assets that need NO salary matching.
    const available: TeamException[] = t.exceptions.map((e) => ({ ...e }));
    const matchedIncoming: TradeAsset[] = [];
    let tpeAbsorbed = 0;
    let minExempt = 0;
    const overCap = t.preTier !== 'below_cap';

    for (const a of t.incomingAssets) {
      if (a.kind !== 'player') continue;
      // minimum-salary exception: an over-the-cap team can always absorb a minimum contract
      if (overCap && a.isMinimum) {
        minExempt += a.salary;
        continue;
      }
      // TPE absorption: a single contract ≤ an available, unexpired, non-aggregable TPE (one player per TPE).
      const tpe = available.find(
        (e) => e.kind === 'tpe' && !e.used && e.amount >= matchValue(a) && !tpeExpired(e.expires, ctx.simulatedDate),
      );
      if (tpe) {
        tpe.used = true;
        tpeAbsorbed += matchValue(a);
        continue;
      }
      matchedIncoming.push(a);
    }

    const incMatched = matchedIncoming.reduce((s, a) => s + matchValue(a), 0);

    // 2) Determine the legal take-back limit for the still-matched portion.
    // Matching uses the outgoing MATCH value (base-year comp reduces a re-signed player's outgoing).
    const outMatch = t.outgoingMatch ?? t.outgoing;
    let limit: number;
    if (nonSim) {
      // non-simultaneous: no 200%/125% expansion; outgoing + $250k, and unused room becomes a TPE
      limit = outMatch + 250_000;
    } else {
      limit = maxIncomingSalary(outMatch, t.preTier, ctx.matching);
      // cap-room team: it may also absorb up to its cap space on top of the outgoing it sends
      if (t.capSpace && t.capSpace > 0) limit = Math.max(limit, outMatch + t.capSpace);
    }

    if (incMatched > limit + 1e-6) {
      const exemptNote =
        tpeAbsorbed || minExempt
          ? ` (already excluding ${fmt(tpeAbsorbed + minExempt)} absorbed via exception/minimum)`
          : '';
      const msg =
        t.outgoing > 0
          ? `${t.abbr} can take back at most ${fmt(limit)} for ${fmt(t.outgoing)} sent out, but are taking back ${fmt(incMatched)}${exemptNote}.`
          : `${t.abbr} are taking back ${fmt(incMatched)} with nothing sent out and no cap space or exception to absorb it (limit ${fmt(limit)}).`;
      out.push({
        code: 'OVER_MATCH',
        severity: 'block',
        teamAbbr: t.abbr,
        message: msg,
        citation: '2023 CBA Art. VII §6 — traded-player salary matching limits.',
        fix: `Send out more salary, take back less, route a contract into a TPE/cap space, or add a minimum-salary filler.`,
      });
    } else if (nonSim) {
      const generated = Math.max(0, t.outgoing - incMatched);
      if (generated > 0) {
        out.push({
          code: 'TPE_GENERATED',
          severity: 'info',
          teamAbbr: t.abbr,
          message: `${t.abbr} generate a $${(generated / 1_000_000).toFixed(1)}M traded-player exception (non-simultaneous trade).`,
          citation: '2023 CBA Art. VII §6(f) — non-simultaneous trade creates a traded-player exception.',
        });
      }
    }
  }
  return out;
};

/** A TPE is unusable if it has expired by the (simulated) trade date. */
function tpeExpired(expires: string | undefined, simDate: string | undefined): boolean {
  if (!expires || !simDate) return false;
  return expires < simDate; // ISO YYYY-MM-DD strings compare lexicographically
}

/**
 * Salary that counts for matching (the receiving side):
 *  - base cap hit, OR for a poison-pill (rookie-scale-extension) player the AVERAGE annual value of
 *    the new deal (current + extension years), which is what the ACQUIRING team matches against;
 *  - plus an unearned trade kicker, capped at the player max.
 */
function matchValue(a: TradeAsset): number {
  let v = a.salary;
  if (a.isRookieScaleExtension && a.futureSalaries && a.futureSalaries.length > 0) {
    const years = [a.salary, ...a.futureSalaries.map((f) => f.salary)];
    v = years.reduce((s, n) => s + n, 0) / years.length;
  }
  if (a.tradeBonusPct && !a.tradeBonusEarned) {
    const bonus = v * a.tradeBonusPct;
    const capped = a.maxSalary ? Math.min(v + bonus, a.maxSalary) - v : bonus;
    v += Math.max(0, capped);
  }
  return v;
}

// referenced for type-only clarity in reviews; PerTeamContext is the shape of ctx.teams[i]
export type { PerTeamContext };
