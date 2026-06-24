import type { TradeAsset, SeasonCap, ApronTier } from './types';
import { tierFor } from './tier';

export interface CapSheetCell {
  season: string;
  total: number;
  tier?: ApronTier;
}

/** Distinct contract seasons present across all player assets, sorted ascending. */
export function allSeasons(assets: TradeAsset[]): string[] {
  const set = new Set<string>();
  for (const a of assets) {
    if (a.kind !== 'player') continue;
    for (const f of a.futureSalaries ?? []) set.add(f.season);
  }
  return [...set].sort();
}

/**
 * Post-trade year-by-year payroll for a team: sum the future salaries of every player that ends
 * up on the team (stays + incoming) per season. This is the "forward cap sheet" Fanspo users miss
 * most — the Holmgren-style $13M→$41M cliff is visible here. Pure.
 */
export function teamCapSheet(
  abbr: string,
  assets: TradeAsset[],
  seasons: string[],
  caps?: Record<string, SeasonCap>,
): CapSheetCell[] {
  const onTeam = assets.filter((a) => a.kind === 'player' && a.toTeam === abbr);
  return seasons.map((season) => {
    const total = onTeam.reduce((s, a) => {
      const fy = a.futureSalaries?.find((f) => f.season === season);
      return s + (fy ? fy.salary : 0);
    }, 0);
    const cap = caps?.[season];
    return { season, total, tier: cap ? tierFor(total, cap) : undefined };
  });
}
