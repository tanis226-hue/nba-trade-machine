import { validateTrade } from '@/lib/cba/validateTrade';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';
import type { TradeAsset, TradeTeamInput, TradeValidation } from '@/lib/cba/types';

const BY_SEASON = {
  '2025-26': { season: SEASON_2025_26, matching: MATCHING_2025_26, apron: APRON_2025_26 },
} as const;

export function selectValidation(state: {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
}): TradeValidation {
  const cfg = BY_SEASON[state.season as keyof typeof BY_SEASON] ?? BY_SEASON['2025-26'];
  return validateTrade({ ...cfg, teams: state.teams, assets: Object.values(state.assets) });
}
