import type { Rule, TradeFinding, PerTeamContext } from '../types';

const STANDARD_MAX = 15;
const STANDARD_MIN = 14;
const TWO_WAY_MAX = 3;

/** Count standard (non-two-way) player assets moving in a direction for a team. */
function standardPlayerDelta(t: PerTeamContext): number {
  const incoming = t.incomingAssets.filter((a) => a.kind === 'player' && !a.isTwoWay).length;
  const outgoing = t.outgoingAssets.filter((a) => a.kind === 'player' && !a.isTwoWay).length;
  return incoming - outgoing;
}

/** Net change in two-way contracts for a team. */
function twoWayDelta(t: PerTeamContext): number {
  const incoming = t.incomingAssets.filter((a) => a.kind === 'player' && a.isTwoWay).length;
  const outgoing = t.outgoingAssets.filter((a) => a.kind === 'player' && a.isTwoWay).length;
  return incoming - outgoing;
}

/**
 * Post-trade standard roster legality.
 * A team carries 12-15 standard players; the absolute max is 15 and the in-season
 * minimum is 14 (with a 2-week grace window to fall below).
 * 2023 CBA Art. X — Player Roster (15 standard max, 14 minimum + 2-week grace).
 */
export const rosterRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  for (const t of ctx.teams) {
    if (t.outgoing === 0 && t.incoming === 0) continue;

    // Two-way contracts: a team may carry at most 3.
    if (t.twoWayCount !== undefined) {
      const newTwoWay = t.twoWayCount + twoWayDelta(t);
      if (newTwoWay > TWO_WAY_MAX) {
        out.push({
          code: 'TWO_WAY_OVER',
          severity: 'block',
          teamAbbr: t.abbr,
          message: `${t.abbr} would carry ${newTwoWay} two-way contracts post-trade, over the 3-contract limit.`,
          citation: '2023 CBA Art. II — maximum 3 two-way contracts per team.',
          fix: `Convert or move out ${newTwoWay - TWO_WAY_MAX} two-way contract(s).`,
        });
      }
    }

    if (t.rosterCount === undefined) continue;

    const newCount = t.rosterCount + standardPlayerDelta(t);

    if (newCount > STANDARD_MAX) {
      out.push({
        code: 'ROSTER_OVER',
        severity: 'block',
        teamAbbr: t.abbr,
        message: `${t.abbr} would carry ${newCount} standard players post-trade, over the 15-man limit.`,
        citation: '2023 CBA Art. X — maximum 15 players on a standard roster.',
        fix: `Waive or trade out ${newCount - STANDARD_MAX} player(s) to a cap-legal roster of 15 or fewer.`,
      });
    } else if (newCount < STANDARD_MIN) {
      out.push({
        code: 'ROSTER_UNDER',
        severity: 'warning',
        teamAbbr: t.abbr,
        message: `${t.abbr} would carry ${newCount} standard players post-trade, under the 14-man minimum.`,
        citation: '2023 CBA Art. X — 14-player minimum (2-week grace period to fall below).',
        fix: `Sign or acquire ${STANDARD_MIN - newCount} player(s) within the 2-week grace window.`,
      });
    }
  }
  return out;
};
