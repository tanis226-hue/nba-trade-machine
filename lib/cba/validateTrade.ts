import type { TradeInput, TradeValidation } from './types';
import { evaluate } from './engine';

/**
 * Single entry point. Builds the rule context and runs the ordered CBA rule pipeline
 * (lib/cba/rules). Returns blocking errors, warnings, and the full finding list with
 * CBA citations for the audit trail.
 */
export function validateTrade(input: TradeInput): TradeValidation {
  return evaluate(input);
}
