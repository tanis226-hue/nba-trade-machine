import type { TradeAsset } from './types';

export const LEGACY_CASH_USAGE_NOTE = 'Prior cash sent and received this season is not supplied. Confirm remaining annual allowances for both teams.';

export function isMovedCash(asset: TradeAsset): boolean {
  return asset.kind === 'cash' && asset.fromTeam !== asset.toTeam;
}

/** Cash consideration is a positive, finite, whole-dollar amount, never matching salary. */
export function hasValidCashAmount(asset: TradeAsset): boolean {
  return Number.isSafeInteger(asset.amount) && (asset.amount ?? 0) > 0;
}

export function formatCash(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
