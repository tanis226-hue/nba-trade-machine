import { validateTrade } from '@/lib/cba/validateTrade';
import { suggestFixes, type FixSuggestion } from '@/lib/cba/autofix';
import {
  SEASON_2025_26,
  MATCHING_2025_26,
  APRON_2025_26,
  SEASON_RULES_2025_26,
  SEASON_2026_27,
  MATCHING_2026_27,
  APRON_2026_27,
  SEASON_RULES_2026_27,
} from '@/lib/cba/constants';
import { DATA_AS_OF } from '@/lib/data/freshness';
import type { TradeAsset, TradeTeamInput, TradeValidation, TradeMethod, TradeInput } from '@/lib/cba/types';

const BY_SEASON = {
  '2026-27': {
    season: SEASON_2026_27,
    matching: MATCHING_2026_27,
    apron: APRON_2026_27,
    rules: SEASON_RULES_2026_27,
  },
  '2025-26': {
    season: SEASON_2025_26,
    matching: MATCHING_2025_26,
    apron: APRON_2025_26,
    rules: SEASON_RULES_2025_26,
  },
} as const;

const DEFAULT_SEASON = '2026-27';

interface TradeState {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate?: string;
  tradeMethod?: TradeMethod;
}

function toInput(state: TradeState): TradeInput {
  const cfg = BY_SEASON[state.season as keyof typeof BY_SEASON] ?? BY_SEASON[DEFAULT_SEASON];
  return {
    ...cfg,
    teams: state.teams,
    assets: Object.values(state.assets),
    // Default to the data's as-of date so timing windows (recently-signed, aggregation lock,
    // no-trade-back, extension freeze) are evaluated by default; the trade-date picker overrides it.
    simulatedDate: state.simulatedDate ?? DATA_AS_OF,
    tradeMethod: state.tradeMethod,
  };
}

export function selectValidation(state: TradeState): TradeValidation {
  return validateTrade(toInput(state));
}

export function selectFixes(state: TradeState): FixSuggestion[] {
  return suggestFixes(toInput(state));
}
