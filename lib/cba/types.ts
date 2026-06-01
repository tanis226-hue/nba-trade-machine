export type ApronTier = 'below_cap' | 'over_cap' | 'over_tax' | 'first_apron' | 'second_apron';

export interface SeasonCap {
  season: string;
  salaryCap: number;
  taxLine: number;
  firstApron: number;
  secondApron: number;
}

export interface MatchingBracket {
  upTo: number; // ordered ascending; last upTo = Infinity
  pct: number;
  add: number;
}
export interface MatchingRules {
  belowApron: MatchingBracket[];
  apronTakebackPct: number;
}

export interface ApronTierRules {
  canAggregate: boolean;
  maxTakebackPct: number;
  blockedTools: string[];
}
export interface ApronRules {
  firstApron: ApronTierRules;
  secondApron: ApronTierRules;
}

export interface TradeAsset {
  id: string;
  kind: 'player' | 'pick';
  salary: number; // 0 for picks
  fromTeam: string;
  toTeam: string;
  label: string;
}
export interface TradeTeamInput {
  abbr: string;
  preTradeSalary: number;
}
export interface TradeInput {
  season: SeasonCap;
  matching: MatchingRules;
  apron: ApronRules;
  teams: TradeTeamInput[];
  assets: TradeAsset[];
}

export interface TeamResult {
  abbr: string;
  outgoing: number;
  incoming: number;
  postSalary: number;
  preTier: ApronTier;
  postTier: ApronTier;
  playersOut: number;
}
export interface TradeError {
  code: string;
  teamAbbr: string;
  message: string;
}
export interface TradeValidation {
  valid: boolean;
  perTeam: TeamResult[];
  errors: TradeError[];
}
