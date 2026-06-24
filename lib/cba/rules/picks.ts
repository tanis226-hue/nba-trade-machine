import type { Rule, TradeAsset, TradeFinding } from '../types';

/** Parse the starting calendar year from a season string like '2025-26' → 2025. */
function seasonStartYear(season: string): number | null {
  const m = /^(\d{4})/.exec(season);
  return m ? Number(m[1]) : null;
}

/**
 * Draft-pick trade legality.
 *  1. Seven-year rule: a pick may not be more than 7 future drafts beyond the current
 *     season's draft → block PICK_TOO_FAR.
 *  2. Frozen pick: a first sufficiently far out is frozen for a second-apron team and
 *     cannot be traded (isFrozen) → block PICK_FROZEN.
 *  3. Ted Stepien rule: a team may not be left without a first-round pick in two
 *     consecutive future years after the trade → block STEPIEN_VIOLATION.
 *
 * 2023 CBA Art. VII §7 (seven-year rule) and the Ted Stepien rule.
 */
export const picksRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  const startYear = seasonStartYear(ctx.season.season);

  for (const team of ctx.teams) {
    const outgoingPicks = team.outgoingAssets.filter((a) => a.kind === 'pick');
    if (outgoingPicks.length === 0) continue;

    for (const pick of outgoingPicks) {
      // (1) Seven-year rule.
      if (startYear != null && typeof pick.pickYear === 'number') {
        // The current season's own draft is year+1 of the cap year; picks may extend
        // up to 7 drafts out. VERIFY: window measured as pickYear - startYear > 7.
        if (pick.pickYear - startYear > 7) {
          out.push({
            code: 'PICK_TOO_FAR',
            severity: 'block',
            teamAbbr: team.abbr,
            message: `${team.abbr} cannot trade ${pick.label}: a ${pick.pickYear} draft pick is more than seven drafts beyond the ${ctx.season.season} season.`,
            citation: '2023 CBA Art. VII §7 — seven-year rule (picks limited to 7 future drafts).',
            fix: `Use a pick in ${startYear + 7} or earlier, or a pick swap instead.`,
          });
        }
      }

      // (2) Frozen pick.
      if (pick.isFrozen === true) {
        out.push({
          code: 'PICK_FROZEN',
          severity: 'block',
          teamAbbr: team.abbr,
          message: `${team.abbr} cannot trade ${pick.label}: this first-round pick is frozen under the second-apron rules.`,
          citation: '2023 CBA Art. VII — second-apron frozen first-round pick may not be traded.',
          fix: `Trade a different, unfrozen pick, or drop below the second apron to unfreeze it.`,
        });
      }
    }

    // (3) Ted Stepien rule.
    const stepien = stepienViolation(team.ownedFirstRoundPicks, outgoingPicks);
    if (stepien) {
      out.push({
        code: 'STEPIEN_VIOLATION',
        severity: 'block',
        teamAbbr: team.abbr,
        message: `${team.abbr} would be left without a first-round pick in consecutive years (${stepien[0]} and ${stepien[1]}).`,
        citation: '2023 CBA — Ted Stepien rule (a team must retain a first in consecutive future drafts).',
        fix: `Keep a first-round pick in ${stepien[0]} or ${stepien[1]}, or add protection so one conveys.`,
      });
    }
  }

  return out;
};

/**
 * Returns the first consecutive pair of years the team would own NO first-round pick
 * after sending away the round===1 picks in this trade, or null if compliant / no data.
 */
function stepienViolation(
  owned: { year: number; conveyed?: boolean; isSwap?: boolean }[] | undefined,
  outgoingPicks: TradeAsset[],
): [number, number] | null {
  if (!owned) return null; // no data → skip Stepien check

  // Only OUTRIGHT firsts being traded away strip a team's pick that year. Trading a swap RIGHT
  // does not remove the team's own first, so swaps don't count toward Stepien exposure.
  const tradedAwayFirsts = new Set(
    outgoingPicks
      .filter((p) => p.round === 1 && !p.isSwap && typeof p.pickYear === 'number')
      .map((p) => p.pickYear as number),
  );

  // A year is "held" if the team owns a non-conveyed first it is NOT trading away, OR holds a swap
  // for that year (a swap guarantees one of two firsts, which satisfies the Stepien requirement).
  const heldYears = new Set(
    owned
      .filter((p) => !p.conveyed && (p.isSwap === true || !tradedAwayFirsts.has(p.year)))
      .map((p) => p.year),
  );

  const ownedYears = owned.map((p) => p.year);
  if (ownedYears.length === 0) return null;

  // Check every consecutive year pair across the team's planning horizon.
  const minYear = Math.min(...ownedYears);
  const maxYear = Math.max(...ownedYears);
  for (let y = minYear; y < maxYear; y++) {
    if (!heldYears.has(y) && !heldYears.has(y + 1)) {
      return [y, y + 1];
    }
  }
  return null;
}
