import type { TradeInput, TradeValidation, TeamResult, TradeError } from './types';
import { tierFor } from './tier';
import { maxIncomingSalary } from './matching';
import { restrictionsFor } from './apron';

export function validateTrade(input: TradeInput): TradeValidation {
  const { season, matching, apron, teams, assets } = input;
  const errors: TradeError[] = [];

  const perTeam: TeamResult[] = teams.map((team) => {
    const out = assets.filter((a) => a.fromTeam === team.abbr);
    const inc = assets.filter((a) => a.toTeam === team.abbr);
    const outgoing = out.reduce((s, a) => s + a.salary, 0);
    const incoming = inc.reduce((s, a) => s + a.salary, 0);
    const postSalary = team.preTradeSalary - outgoing + incoming;
    return {
      abbr: team.abbr,
      outgoing,
      incoming,
      postSalary,
      preTier: tierFor(team.preTradeSalary, season),
      postTier: tierFor(postSalary, season),
      playersOut: out.filter((a) => a.kind === 'player').length,
    };
  });

  for (const t of perTeam) {
    if (t.outgoing === 0 && t.incoming === 0) continue;
    const restr = restrictionsFor(t.preTier, apron);

    if (t.playersOut >= 2 && !restr.canAggregate) {
      errors.push({
        code: 'NO_AGGREGATION',
        teamAbbr: t.abbr,
        message: `${t.abbr} are above the second apron and cannot aggregate salaries in a trade.`,
      });
    }

    if (t.outgoing > 0) {
      const limit = maxIncomingSalary(t.outgoing, t.preTier, matching);
      if (t.incoming > limit) {
        errors.push({
          code: 'OVER_MATCH',
          teamAbbr: t.abbr,
          message: `${t.abbr} can take back at most ${fmt(limit)} for ${fmt(t.outgoing)} sent out, but are taking back ${fmt(t.incoming)}.`,
        });
      }
    }
  }

  return { valid: errors.length === 0, perTeam, errors };
}

function fmt(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n}`;
}
