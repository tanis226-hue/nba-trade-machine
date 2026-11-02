import { selectValidation } from '@/lib/store/selectValidation';
import { DATA_AS_OF } from '@/lib/data/freshness';
import type { TradeRequest } from './schema';
export const RULES_VERSION='2026-11-02.2';
export function snapshotTrade(payload:TradeRequest) {
  const simulatedDate=payload.simulatedDate??DATA_AS_OF;
  return {
    ...payload,simulatedDate,tradeMethod:payload.tradeMethod??'simultaneous',
    schemaVersion:1 as const,rulesVersion:RULES_VERSION,dataVersion:DATA_AS_OF,createdAt:new Date().toISOString(),
    validation:selectValidation({...payload,simulatedDate}),
  };
}
