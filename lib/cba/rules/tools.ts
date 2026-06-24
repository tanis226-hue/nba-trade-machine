import type { Rule, TradeFinding, ToolUsage } from '../types';

/**
 * Apron tool restrictions. A team at/above an apron may not USE certain roster tools at all
 * (distinct from the hard cap a tool triggers for a team below it). The forbidden lists live on
 * ApronRules.{firstApron,secondApron}.blockedTools; this rule is the consumer that enforces them.
 * 2023 CBA Art. VII — first/second apron tool prohibitions.
 */

// Map our ToolUsage values to the labels used in ApronTierRules.blockedTools.
const TOOL_BLOCK_LABEL: Record<ToolUsage, string> = {
  non_taxpayer_mle: 'non_taxpayer_mle',
  bae: 'bae',
  prior_year_tpe: 'prior_year_tpe',
  sign_and_trade_acquire: 'sign_and_trade',
  taxpayer_mle: 'mle',
};
const TOOL_NAME: Record<ToolUsage, string> = {
  non_taxpayer_mle: 'the Non-Taxpayer Mid-Level Exception',
  bae: 'the Bi-Annual Exception',
  prior_year_tpe: 'a prior-year traded-player exception',
  sign_and_trade_acquire: 'a sign-and-trade acquisition',
  taxpayer_mle: 'the Taxpayer Mid-Level Exception',
};

export const toolsRule: Rule = (ctx) => {
  const out: TradeFinding[] = [];
  for (const t of ctx.teams) {
    const tools = t.toolsUsed ?? [];
    if (tools.length === 0) continue;
    const blocked =
      t.preTier === 'second_apron'
        ? ctx.apron.secondApron.blockedTools
        : t.preTier === 'first_apron'
          ? ctx.apron.firstApron.blockedTools
          : [];
    if (blocked.length === 0) continue;
    const tierLabel = t.preTier === 'second_apron' ? 'second apron' : 'first apron';
    for (const tool of tools) {
      if (blocked.includes(TOOL_BLOCK_LABEL[tool])) {
        out.push({
          code: 'TOOL_BLOCKED',
          severity: 'block',
          teamAbbr: t.abbr,
          message: `${t.abbr} are over the ${tierLabel} and cannot use ${TOOL_NAME[tool]}.`,
          citation: `2023 CBA Art. VII — a team over the ${tierLabel} is prohibited from using ${TOOL_NAME[tool]}.`,
          fix: `Get ${t.abbr} below the ${tierLabel}, or complete the move without ${TOOL_NAME[tool]}.`,
        });
      }
    }
  }
  return out;
};
