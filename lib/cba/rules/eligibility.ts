import type { Rule, TradeFinding, TradeAsset } from '../types';

/**
 * Date-aware trade eligibility windows (2023 CBA Art. VII).
 *
 * Only runs when ctx.simulatedDate is provided; otherwise no-op. For each outgoing
 * player it checks three time-gated restrictions:
 *   1. RECENTLY_SIGNED — a newly-signed player generally cannot be traded for ~3 months
 *      (or until Dec 15, whichever is later). Conditional.
 *   2. AGG_LOCK — a just-acquired player cannot be aggregated with another outgoing
 *      player for 2 months after acquisition. Block (only when the team aggregates).
 *   3. EXT_FREEZE — a recently-extended player is frozen from being traded for ~6 months
 *      after signing the extension. Block.
 *   4. NO_TRADE_BACK — a player acquired via trade cannot be dealt BACK to the team that
 *      traded him for 1 year (anti-circumvention). Block (only when routed to that team).
 *
 * The evaluation date is ctx.simulatedDate (the user's "trade date"); selectValidation defaults it
 * to the data's as-of date so these windows are active by default. All date math is pure ISO-string
 * arithmetic (no Date.now()).
 */

// Parse an ISO date (YYYY-MM-DD or full ISO) into a UTC epoch-day count. Returns null if unparseable.
function isoToEpochDay(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
}

// Add a whole number of calendar months to an ISO date, returning a new ISO YYYY-MM-DD string.
function addMonthsIso(iso: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1 + months;
  const d = Number(m[3]);
  const base = new Date(Date.UTC(y, mo, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  // Clamp the day to the last valid day of the target month (e.g. Jan 31 + 1mo → Feb 28/29).
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// The later (max) of two ISO dates.
function laterIso(a: string, b: string): string {
  const ea = isoToEpochDay(a);
  const eb = isoToEpochDay(b);
  if (ea == null) return b;
  if (eb == null) return a;
  return ea >= eb ? a : b;
}

// VERIFY: exact windows. CBA uses 3 months (recently-signed), 2 months (aggregation),
// and 6 months (extension) as the canonical durations; the recently-signed gate also
// holds at least until Dec 15 of the league year.
const RECENTLY_SIGNED_MONTHS = 3;
const AGG_LOCK_MONTHS = 2;
const EXT_FREEZE_MONTHS = 6;
const NO_TRADE_BACK_MONTHS = 12;

export const eligibilityRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  const sim = ctx.simulatedDate;
  const simDay = isoToEpochDay(sim);
  if (sim == null || simDay == null) return out; // date-unaware: no-op

  // Dec 15 of the league year is derived from the season's calendar when available.
  const decGuarantee = ctx.rules?.calendar?.decGuaranteeEligible;

  // Trade-deadline freeze: no in-season trades from the deadline until the season ends. Use a
  // conservative window [deadline, June 1 of that year] so offseason (draft/FA) trades never trip it.
  const deadline = ctx.rules?.calendar?.tradeDeadline;
  const deadlineDay = isoToEpochDay(deadline);
  if (deadline && deadlineDay != null && simDay >= deadlineDay) {
    const seasonEnd = `${deadline.slice(0, 4)}-06-01`;
    const seasonEndDay = isoToEpochDay(seasonEnd);
    if (seasonEndDay != null && simDay < seasonEndDay) {
      out.push({
        code: 'TRADE_DEADLINE',
        severity: 'block',
        message: `Trades are frozen after the ${deadline} trade deadline until the season ends; ${sim} is inside that window.`,
        citation: '2023 CBA Art. VII — no trades may be made between the trade deadline and the end of the season.',
        fix: `Set the trade date before ${deadline}, or wait for the offseason.`,
      });
    }
  }

  for (const t of ctx.teams) {
    if (t.outgoing === 0 && t.incoming === 0) continue;
    const players = t.outgoingAssets.filter((a) => a.kind === 'player');
    const aggregating = players.length >= 2;

    for (const p of players) {
      // (1) Recently-signed.
      const signedDay = isoToEpochDay(p.signedDate);
      if (p.signedDate && signedDay != null) {
        let eligible = addMonthsIso(p.signedDate, RECENTLY_SIGNED_MONTHS);
        if (decGuarantee) eligible = laterIso(eligible, decGuarantee);
        const eligibleDay = isoToEpochDay(eligible);
        if (eligibleDay != null && simDay < eligibleDay) {
          out.push({
            code: 'RECENTLY_SIGNED',
            severity: 'conditional',
            teamAbbr: t.abbr,
            message: `${p.label} was signed on ${p.signedDate} and is not trade-eligible until ${eligible}.`,
            citation: '2023 CBA Art. VII — newly-signed players are trade-restricted for ~3 months (or until Dec 15, whichever is later).',
            fix: `Wait until ${eligible} to trade ${p.label}, or substitute a trade-eligible player.`,
            legalOnDate: eligible,
          });
        }
      }

      // (4) No-trade-back: can't deal an acquired player back to the team that traded him for 1 year.
      const acquiredDay = isoToEpochDay(p.acquiredDate);
      if (p.acquiredFrom && p.acquiredDate && acquiredDay != null && p.toTeam === p.acquiredFrom) {
        const eligible = addMonthsIso(p.acquiredDate, NO_TRADE_BACK_MONTHS);
        const eligibleDay = isoToEpochDay(eligible);
        if (eligibleDay != null && simDay < eligibleDay) {
          out.push({
            code: 'NO_TRADE_BACK',
            severity: 'block',
            teamAbbr: t.abbr,
            message: `${p.label} was acquired from ${p.acquiredFrom} on ${p.acquiredDate} and cannot be traded back to ${p.acquiredFrom} until ${eligible}.`,
            citation: '2023 CBA Art. VII — a player acquired in a trade cannot be re-acquired by the team that traded him for one year.',
            fix: `Send ${p.label} to a different team, or wait until ${eligible}.`,
            legalOnDate: eligible,
          });
        }
      }

      // (2) Aggregation lock (only matters when this team aggregates 2+ players).
      if (aggregating && p.acquiredDate && acquiredDay != null) {
        const unlock = addMonthsIso(p.acquiredDate, AGG_LOCK_MONTHS);
        const unlockDay = isoToEpochDay(unlock);
        if (unlockDay != null && simDay < unlockDay) {
          out.push({
            code: 'AGG_LOCK',
            severity: 'block',
            teamAbbr: t.abbr,
            message: `${p.label} was acquired on ${p.acquiredDate} and cannot be aggregated with another player until ${unlock}.`,
            citation: '2023 CBA Art. VII — a just-acquired player cannot be aggregated in a trade for 2 months after acquisition.',
            fix: `Wait until ${unlock}, or send ${p.label} alone (do not aggregate with another player).`,
            legalOnDate: unlock,
          });
        }
      }

      // (3) Extension freeze.
      const extendedDay = isoToEpochDay(p.extendedDate);
      if (p.extendedDate && extendedDay != null) {
        const unfreeze = addMonthsIso(p.extendedDate, EXT_FREEZE_MONTHS);
        const unfreezeDay = isoToEpochDay(unfreeze);
        if (unfreezeDay != null && simDay < unfreezeDay) {
          out.push({
            code: 'EXT_FREEZE',
            severity: 'block',
            teamAbbr: t.abbr,
            message: `${p.label} signed an extension on ${p.extendedDate} and is trade-frozen until ${unfreeze}.`,
            citation: '2023 CBA Art. VII — an extended player is trade-restricted for ~6 months after signing the extension.',
            fix: `Wait until ${unfreeze} to trade ${p.label}, or remove the extension from the deal.`,
            legalOnDate: unfreeze,
          });
        }
      }
    }
  }
  return out;
};
