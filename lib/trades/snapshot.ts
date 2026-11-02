import { selectValidation } from '@/lib/store/selectValidation';
import { defaultTradeDate } from '@/lib/data/freshness';
import type { TradeRequest } from './schema';
export const RULES_VERSION='2026-11-02.2';
export function snapshotTrade(payload:TradeRequest) {
  const simulatedDate=payload.simulatedDate??defaultTradeDate(payload.season);
  return {
    ...payload,simulatedDate,tradeMethod:payload.tradeMethod??'simultaneous',
    schemaVersion:1 as const,rulesVersion:RULES_VERSION,dataVersion:payload.dataVersion??'custom-unversioned',createdAt:new Date().toISOString(),
    validation:selectValidation({...payload,simulatedDate}),
  };
}
