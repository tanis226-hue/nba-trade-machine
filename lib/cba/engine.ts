import type {
  TradeInput,
  TradeValidation,
  RuleContext,
  PerTeamContext,
  TradeTeamInput,
  SeasonCap,
  TradeFinding,
  Rule,
} from './types';
import { tierFor } from './tier';
import { RULES } from './rules';

const FIRST_APRON_HARD_CAP_TOOLS = new Set(['non_taxpayer_mle', 'bae', 'prior_year_tpe', 'sign_and_trade_acquire']);
const SECOND_APRON_HARD_CAP_TOOLS = new Set(['taxpayer_mle']);

/**
 * Derive the hard-cap line a team is bound to for the season. A hard cap is absolute: post-trade
 * salary may not exceed it. Triggers:
 *   - using the Non-Taxpayer MLE / BAE / a prior-year (expanded) TPE / acquiring via sign-and-trade → first apron
 *   - using the Taxpayer MLE → second apron
 *   - taking back MORE salary than is sent out (the expanded traded-player exception) → first apron
 * Returns the tightest (lowest) applicable line, or any pre-existing line, else null.
 * 2023 CBA Art. VII §6 — apron hard caps.
 */
function deriveHardCap(team: TradeTeamInput, preTier: string, incoming: number, outgoing: number, season: SeasonCap): number | null {
  let line = team.hardCapLine ?? null;
  const apply = (v: number) => (line = line == null ? v : Math.min(line, v));
  const tools = team.toolsUsed ?? [];
  if (tools.some((t) => FIRST_APRON_HARD_CAP_TOOLS.has(t))) apply(season.firstApron);
  if (tools.some((t) => SECOND_APRON_HARD_CAP_TOOLS.has(t))) apply(season.secondApron);
  // In-trade: an over-the-cap team that takes back more than it sends used the matching expansion
  // (a traded-player exception) and is hard-capped at the first apron for the rest of the season.
  if (preTier !== 'below_cap' && incoming > outgoing) apply(season.firstApron);
  return line;
}

/** Build the immutable per-team + global context every rule reads. */
export function buildContext(input: TradeInput): RuleContext {
  const teams: PerTeamContext[] = input.teams.map((team) => {
    // Only assets that actually change teams count as a trade. The UI registers every
    // roster player as an asset defaulting to Stay (fromTeam===toTeam); ignore those or an
    // untouched roster reads as outgoing+incoming and trips phantom flags.
    const outgoingAssets = input.assets.filter((a) => a.fromTeam === team.abbr && a.toTeam !== team.abbr);
    const incomingAssets = input.assets.filter((a) => a.toTeam === team.abbr && a.fromTeam !== team.abbr);
    const outgoing = outgoingAssets.reduce((s, a) => s + a.salary, 0);
    const incoming = incomingAssets.reduce((s, a) => s + a.salary, 0);
    const postSalary = team.preTradeSalary - outgoing + incoming;
    const preTier = tierFor(team.preTradeSalary, input.season);
    return {
      abbr: team.abbr,
      outgoing,
      incoming,
      postSalary,
      preTier,
      postTier: tierFor(postSalary, input.season),
      playersOut: outgoingAssets.filter((a) => a.kind === 'player').length,
      preTradeSalary: team.preTradeSalary,
      apronSalary: team.apronSalary ?? team.preTradeSalary,
      capSpace: team.capSpace,
      hardCapLine: deriveHardCap(team, preTier, incoming, outgoing, input.season),
      exceptions: team.exceptions ?? [],
      rosterCount: team.rosterCount,
      openRosterSpots: team.openRosterSpots,
      twoWayCount: team.twoWayCount,
      toolsUsed: team.toolsUsed,
      priorSecondApronSeasons: team.priorSecondApronSeasons,
      isRepeaterTaxpayer: team.isRepeaterTaxpayer,
      ownedFirstRoundPicks: team.ownedFirstRoundPicks,
      outgoingAssets,
      incomingAssets,
    };
  });

  return {
    season: input.season,
    matching: input.matching,
    apron: input.apron,
    rules: input.rules,
    simulatedDate: input.simulatedDate,
    tradeMethod: input.tradeMethod ?? 'simultaneous',
    teams,
    assets: input.assets,
  };
}

/** Run an ordered set of rules against a context and collect all findings. */
export function runRules(ctx: RuleContext, rules: Rule[] = RULES): TradeFinding[] {
  const findings: TradeFinding[] = [];
  for (const rule of rules) {
    try {
      findings.push(...rule(ctx));
    } catch {
      // A buggy/half-built rule must never crash the whole validation. Skip it.
    }
  }
  return findings;
}

export function evaluate(input: TradeInput, rules: Rule[] = RULES): TradeValidation {
  const ctx = buildContext(input);
  const findings = runRules(ctx, rules);
  const errors = findings.filter((f) => f.severity === 'block');
  const warnings = findings.filter((f) => f.severity === 'warning');
  return {
    valid: errors.length === 0,
    perTeam: ctx.teams.map((t) => ({
      abbr: t.abbr,
      outgoing: t.outgoing,
      incoming: t.incoming,
      postSalary: t.postSalary,
      preTier: t.preTier,
      postTier: t.postTier,
      playersOut: t.playersOut,
      apronPostSalary: t.apronSalary - t.outgoing + t.incoming,
      capSpacePost: t.capSpace,
      hardCapLine: t.hardCapLine,
      generatedTpe: t.generatedTpe,
    })),
    errors,
    warnings,
    findings,
  };
}
