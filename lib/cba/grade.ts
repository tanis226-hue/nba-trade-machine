import type { TradeAsset, TradeTeamInput } from './types';
import { pickValue } from './pickValue';

export interface TeamGrade {
  abbr: string;
  inValue: number;
  outValue: number;
  net: number;
  surplusNet: number; // value net AFTER adjusting for the salary taken on vs sent out
}

// League-ish on-court value (Game Score) produced per $1M of salary; players above this are bargains.
const VALUE_PER_M = 0.5;
export interface TradeGradeResult {
  teams: TeamGrade[];
  spread: number; // max net - min net across teams
  verdict: string;
  favored?: string; // team that gains the most value (only when meaningfully tilted)
}

/** Trade value of one asset in per-game value units (players: Game Score; picks: pick curve). */
export function assetValue(a: TradeAsset): number {
  if (a.kind === 'player') return a.value ?? 0;
  if (a.kind === 'pick') return pickValue(a.round ?? 2, a.pickYear);
  return 0; // cash / tpe carry no on-court value
}

/** Value net of salary cost — a star on a rookie deal beats the same star on a max. */
export function assetSurplus(a: TradeAsset): number {
  if (a.kind !== 'player') return assetValue(a); // picks/cash are ~free, so surplus = value
  return assetValue(a) - (a.salary / 1_000_000) * VALUE_PER_M;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Composite fairness grade: each team's incoming vs outgoing on-court value (talent + picks).
 * A balanced deal has nets near zero; a tilted one names who gains. Beats Fanspo's community-vote
 * bar with an objective, transparent number.
 */
export function gradeTrade(teams: TradeTeamInput[], assets: TradeAsset[]): TradeGradeResult {
  const tg: TeamGrade[] = teams.map((t) => {
    const inA = assets.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
    const outA = assets.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
    const inValue = r1(inA.reduce((s, a) => s + assetValue(a), 0));
    const outValue = r1(outA.reduce((s, a) => s + assetValue(a), 0));
    const surplusNet = r1(
      inA.reduce((s, a) => s + assetSurplus(a), 0) - outA.reduce((s, a) => s + assetSurplus(a), 0),
    );
    return { abbr: t.abbr, inValue, outValue, net: r1(inValue - outValue), surplusNet };
  });

  const nets = tg.map((t) => t.net);
  const spread = r1(Math.max(...nets, 0) - Math.min(...nets, 0));
  const favored = tg.slice().sort((a, b) => b.net - a.net)[0];
  const anyMovement = tg.some((t) => t.inValue > 0 || t.outValue > 0);

  let verdict: string;
  if (!anyMovement) verdict = 'No players or picks moved yet.';
  else if (spread <= 3) verdict = 'Even deal — both sides give and get comparable value.';
  else verdict = `Favors ${favored.abbr} by ${spread} value pts.`;

  return { teams: tg, spread, verdict, favored: anyMovement && spread > 3 ? favored.abbr : undefined };
}
