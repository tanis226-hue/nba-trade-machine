import type { Rule } from '../types';
import { matchingRule } from './matching';
import { aggregationRule } from './aggregation';
import { hardCapRule } from './hardCap';
import { secondApronExtrasRule } from './secondApronExtras';
import { signAndTradeRule } from './signAndTrade';
import { cashRule } from './cash';
import { picksRule } from './picks';
import { rosterRule } from './roster';
import { ntcRule } from './ntc';
import { eligibilityRule } from './eligibility';
import { toolsRule } from './tools';
import { floorRule } from './floor';
import { taxRule } from './tax';

/**
 * Ordered CBA rule pipeline. validateTrade (via the engine) runs these in sequence and collects
 * findings. matchingRule is comprehensive (it considers cap-room / TPE / minimum / non-simultaneous
 * paths); the rest are independent additive constraints. Each finding carries a CBA citation.
 */
export const RULES: Rule[] = [
  matchingRule,
  aggregationRule,
  hardCapRule,
  secondApronExtrasRule,
  signAndTradeRule,
  cashRule,
  picksRule,
  rosterRule,
  ntcRule,
  eligibilityRule,
  toolsRule,
  floorRule,
  taxRule,
];
