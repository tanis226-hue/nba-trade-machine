import type { Rule, TradeFinding } from '../types';
import { fmt } from '../format';

/**
 * Minimum team salary floor. Each team must carry total salary of at least the
 * league minimum (90% of the salary cap). Enforced at season end, not at trade
 * time, so a post-trade dip below the floor is a warning, never a block.
 */
export const floorRule: Rule = (ctx) => {
  const floor = ctx.season.minTeamSalary ?? ctx.rules?.cap.minTeamSalary;
  if (floor == null) return [];

  const findings: TradeFinding[] = [];
  for (const team of ctx.teams) {
    if (team.postSalary < floor) {
      findings.push({
        code: 'MIN_TEAM_SALARY',
        severity: 'warning',
        teamAbbr: team.abbr,
        message: `${team.abbr} would fall below the ${fmt(floor)} minimum team salary.`,
        citation: '2023 CBA Art. VII — Minimum Team Salary (90% of Salary Cap)',
      });
    }
  }
  return findings;
};
