import type { FixAction } from '@/lib/cba/autofix';
import type { TradeAsset, TradeValidation } from '@/lib/cba/types';
import { formatCash } from '@/lib/cba/cash';
import type { PersistedTradeState } from './tradeStore';
import { selectValidation } from './selectValidation';

/** Only the actual working proposal participates; comparison selection and UI state do not. */
export function workingStateKey(state: PersistedTradeState): string {
  return JSON.stringify({
    season: state.season,
    dataVersion: state.dataVersion,
    teams: state.teams,
    assets: state.assets,
    simulatedDate: state.simulatedDate,
    tradeMethod: state.tradeMethod,
    playerSort: state.playerSort,
  });
}

export interface ReviewedChange {
  assetId: string;
  label: string;
  origin: string;
  previousDestination: string;
  destination: string;
  removed: boolean;
}

export interface FixPreview {
  key: string;
  changes: ReviewedChange[];
  assets: Record<string, TradeAsset>;
  validation: TradeValidation;
}

/** Build and validate the exact proposal shown in the preview; never change assumptions. */
export function previewFix(state: PersistedTradeState, actions: FixAction[]): FixPreview | null {
  if (!actions.length) return null;
  const seen = new Set<string>();
  const assets = { ...state.assets };
  const changes: ReviewedChange[] = [];
  for (const action of actions) {
    const asset = assets[action.assetId];
    if (!asset || seen.has(asset.id) || asset.toTeam === action.toTeam
      || !state.teams.some(team => team.abbr === action.toTeam)) return null;
    seen.add(asset.id);
    const orders = Object.values(assets).filter(other => other.id !== asset.id
      && other.toTeam === action.toTeam && other.kind === asset.kind).map(other => other.order ?? 0);
    assets[asset.id] = { ...asset, toTeam: action.toTeam, order: orders.length ? Math.max(...orders) + 1 : 0 };
    const label = asset.kind === 'cash'
      ? `${asset.label} (${asset.amount != null && Number.isFinite(asset.amount) ? formatCash(asset.amount) : 'amount not supplied'})`
      : asset.label;
    changes.push({ assetId: asset.id, label, origin: asset.fromTeam,
      previousDestination: asset.toTeam, destination: action.toTeam, removed: action.toTeam === asset.fromTeam });
  }
  // A proposal that removes the entire trade is not a useful remedy.
  if (!Object.values(assets).some(asset => asset.fromTeam !== asset.toTeam)) return null;
  return { key: workingStateKey(state), changes, assets, validation: selectValidation({ ...state, assets }) };
}
