import type { Rule, TradeFinding, PerTeamContext, TradeAsset } from '../types';
import { fmt } from '../format';
import { formatCash, hasValidCashAmount, isMovedCash } from '../cash';

/**
 * HARD CAP enforcement.
 *
 * (1) If a team already carries a hard cap line for the season (`hardCapLine`),
 *     its post-trade APRON salary may not exceed it → block HARD_CAP_EXCEEDED.
 * (2) A team that ACQUIRES a player signed-and-traded to it becomes hard-capped
 *     at the first apron for the rest of the season. If its post-trade apron
 *     salary exceeds the first apron → block HARD_CAP_ST.
 *
 * Citation: 2023 CBA Art. VII, §6(f)/(g) — a team that acquires a player via
 * sign-and-trade, or that uses the Non-Taxpayer MLE or the Bi-Annual Exception,
 * is hard-capped at the first apron for the remainder of that Salary Cap Year.
 */
export function postApronSalary(team: PerTeamContext): number {
  // Prefer an explicit apron-basis hit per asset when present, else the cap hit. The trade kicker
  // travels with the player to the acquiring team, so it adds to the INCOMING apron hit only.
  const base = (a: TradeAsset) => (a.apronSalary != null ? a.apronSalary : a.salary);
  const withKicker = (a: TradeAsset) => {
    let v = base(a);
    if (a.tradeBonusPct && !a.tradeBonusEarned) {
      const bonus = v * a.tradeBonusPct;
      v += a.maxSalary ? Math.max(0, Math.min(v + bonus, a.maxSalary) - v) : bonus;
    }
    return v;
  };
  const incoming = team.incomingAssets.filter((a) => a.kind === 'player').reduce((s, a) => s + withKicker(a), 0);
  const outgoing = team.outgoingAssets.filter((a) => a.kind === 'player').reduce((s, a) => s + base(a), 0);
  return team.apronSalary - outgoing + incoming;
}

export const hardCapRule: Rule = (ctx) => {
  const findings: TradeFinding[] = [];

  for (const team of ctx.teams) {
    if (!Array.isArray(team.incomingAssets) || !Array.isArray(team.outgoingAssets)) continue;

    const post = postApronSalary(team);
    const money = team.outgoingAssets.some((a) => isMovedCash(a) && hasValidCashAmount(a)) ? formatCash : fmt;

    // (1) Pre-existing hard cap line.
    if (typeof team.hardCapLine === 'number' && post > team.hardCapLine) {
      const over = post - team.hardCapLine;
      findings.push({
        code: 'HARD_CAP_EXCEEDED',
        severity: 'block',
        teamAbbr: team.abbr,
        message: `${team.abbr} is hard-capped at ${money(team.hardCapLine)}. Post-trade apron salary ${money(post)} exceeds it by ${money(over)}.`,
        citation: '2023 CBA Art. VII, §2(e)(2)(i), (4) — post-transaction apron limit and hard cap for the Salary Cap Year',
        fix: `Shed at least ${money(over)} in apron salary (send out more / take back less) to stay at or below ${money(team.hardCapLine)}.`,
      });
    }

    // (2) Acquiring a sign-and-trade player triggers a first-apron hard cap.
    const acquiresSignAndTrade = team.incomingAssets.some((a) => a.kind === 'player' && a.signedVia === 'sign_and_trade');
    if (acquiresSignAndTrade) {
      const firstApron = ctx.season.firstApron;
      if (typeof firstApron === 'number' && post > firstApron) {
        const over = post - firstApron;
        findings.push({
          code: 'HARD_CAP_ST',
          severity: 'block',
          teamAbbr: team.abbr,
          message: `${team.abbr} acquires a sign-and-trade player and is hard-capped at the first apron ${fmt(firstApron)}. Post-trade apron salary ${fmt(post)} exceeds it by ${fmt(over)}.`,
          citation: '2023 CBA Art. VII, §6(g) — acquiring a player via sign-and-trade hard-caps the team at the first apron for the season',
          fix: `Reduce post-trade apron salary by ${fmt(over)} (or restructure without acquiring the sign-and-trade player) to stay at or below ${fmt(firstApron)}.`,
        });
      }
    }
  }

  return findings;
};
