export type ApronTier = 'below_cap' | 'over_cap' | 'over_tax' | 'first_apron' | 'second_apron';

export interface SeasonCap {
  season: string;
  salaryCap: number;
  taxLine: number;
  firstApron: number;
  secondApron: number;
  minTeamSalary?: number; // floor (90% of cap); enforced season-end → warning only
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

// ----- Extended season rule data (tax, calendar, scales, limits) -----
export interface TaxBracket {
  upTo: number; // amount over the tax line, ascending; last = Infinity
  rate: number; // standard multiplier
  repeaterRate: number; // repeater multiplier (taxpayer in 3 of prior 4 yrs)
}
export interface LeagueCalendar {
  tradeDeadline: string; // ISO date
  decGuaranteeEligible: string; // Dec 15 — offseason-signed FAs become tradeable
  janFifteen: string; // Jan 15 — certain re-sign trade eligibility
  moratoriumEnd: string; // early July
  aggregationCutoff: string; // ~Dec 15, players signed after can't be aggregated until later
}
export interface SeasonRules {
  cap: SeasonCap;
  matching: MatchingRules;
  apron: ApronRules;
  taxBrackets?: TaxBracket[];
  calendar?: LeagueCalendar;
  cashLimit?: number; // max cash sent or received per season (separate directions)
  minSalaryByYos?: number[]; // index = years of service
}

// ----- Assets -----
export type AssetKind = 'player' | 'pick' | 'cash' | 'tpe';
export type SignedVia =
  | 'bird' | 'early_bird' | 'non_bird' | 'cap_room'
  | 'non_taxpayer_mle' | 'taxpayer_mle' | 'room_mle' | 'bae'
  | 'minimum' | 'rookie_scale' | 'sign_and_trade' | 'extension';

export interface PickProtection {
  type?: 'top' | 'range' | 'unprotected';
  through?: number; // e.g. top-4
  years?: [number, number];
  rolloverToSecond?: boolean;
  note?: string; // freeform protection prose as researched (e.g. "top-4", "top-10 then 2nds")
}

export interface TradeAsset {
  id: string;
  kind: AssetKind;
  salary: number; // cap hit for matching; 0 for picks
  fromTeam: string;
  toTeam: string;
  label: string;

  // --- player detail (all optional; rules degrade gracefully when absent) ---
  apronSalary?: number; // apron-basis hit if it differs from cap hit
  tradeBonusPct?: number; // kicker, ≤0.15
  tradeBonusEarned?: boolean; // already paid → no longer counts
  signedVia?: SignedVia;
  noTradeClause?: boolean;
  impliedNtc?: boolean; // 1-yr Bird re-sign / 1-yr+option auto-veto
  isTwoWay?: boolean;
  isMinimum?: boolean;
  isRookieScaleExtension?: boolean; // poison-pill detection
  isBaseYearComp?: boolean; // S&T re-sign (Bird, over-cap, >20% raise): outgoing matches at max(50% new, prior)
  bycPriorSalary?: number; // prior-season salary, the floor of the BYC outgoing match value
  signed?: boolean; // a free agent signed in-app (adds real payroll to its team)
  restrictedFa?: boolean; // signed as an RFA (offer-sheet / match framing)
  signedDate?: string; // ISO; recently-signed eligibility
  acquiredDate?: string; // ISO; 2-month aggregation lock + 1-year no-trade-back
  acquiredFrom?: string; // team code the player was traded from (for the no-trade-back rule)
  extendedDate?: string; // ISO; 6-month extension freeze
  designatedVetDate?: string; // ISO; designated-veteran (supermax) extension → 1-year no-trade
  matchedOfferDate?: string; // ISO; matched RFA offer sheet → 1-year no-trade without consent
  isOver38?: boolean; // contract subject to the over-38 rule (cap hit reallocated)
  guaranteedThrough?: string; // ISO; partial-guarantee date
  age?: number;
  maxSalary?: number; // player's max (for kicker-at-max voiding)
  futureSalaries?: { season: string; salary: number; optionType?: OptionType }[];
  origSalary?: number; // original current-season salary, so an in-app contract edit can be reset
  order?: number; // display order within a team's list (drag-to-rearrange)
  value?: number; // on-court value (per-game Game Score) for trade grading
  pts?: number;
  reb?: number;
  ast?: number;
  position?: string;
  height?: string;
  weight?: number;
  jersey?: string;
  headshot?: string;

  // --- pick detail ---
  pickYear?: number;
  round?: 1 | 2;
  protections?: PickProtection | null;
  isSwap?: boolean;
  originalTeam?: string;
  isFrozen?: boolean;

  // --- cash / tpe ---
  amount?: number;
  expires?: string; // ISO
}
export type OptionType = 'team' | 'player' | 'eto' | 'guaranteed';

export interface TeamException {
  kind: 'tpe' | 'non_taxpayer_mle' | 'taxpayer_mle' | 'room_mle' | 'bae' | 'room';
  amount: number;
  expires?: string;
  createdFromSignAndTrade?: boolean;
  used?: boolean; // marked when consumed during matching evaluation
}

export interface TradeTeamInput {
  abbr: string;
  preTradeSalary: number; // cap-basis team salary pre-trade
  apronSalary?: number; // apron-basis team salary pre-trade (defaults to preTradeSalary)
  capSpace?: number; // if below the cap
  hardCapLine?: number | null; // existing hard cap for the season, if any
  exceptions?: TeamException[]; // available TPE/MLE/BAE/room
  rosterCount?: number;
  openRosterSpots?: number;
  twoWayCount?: number; // current two-way contracts (max 3)
  toolsUsed?: ToolUsage[]; // hard-cap-triggering tools this team uses in/around the deal
  priorSecondApronSeasons?: number; // for frozen-pick derivation
  isRepeaterTaxpayer?: boolean;
  priorTaxpayerSeasons?: number; // taxpayer count in the prior 4 seasons (>=3 → repeater)
  ownedFirstRoundPicks?: { year: number; conveyed?: boolean; isSwap?: boolean }[]; // for Stepien
}

/** A roster tool whose use hard-caps the team for the season (which apron depends on the tool). */
export type ToolUsage =
  | 'non_taxpayer_mle' | 'bae' | 'prior_year_tpe' | 'sign_and_trade_acquire' // → first apron
  | 'taxpayer_mle'; // → (used over the tax) does not hard-cap; included for completeness

// ----- Validation output -----
export type Severity = 'block' | 'warning' | 'info' | 'conditional';

export interface TradeFinding {
  code: string;
  severity: Severity;
  teamAbbr?: string;
  message: string;
  citation?: string; // CBA reference for the audit trail
  fix?: string; // suggested remedy (auto-fixer seed)
  legalOnDate?: string; // ISO; for conditional/date-gated findings
}
/** Back-compat: blocking findings, shaped like the original error type. */
export interface TradeError {
  code: string;
  teamAbbr: string;
  message: string;
}

export interface TeamResult {
  abbr: string;
  outgoing: number;
  incoming: number;
  postSalary: number;
  preTier: ApronTier;
  postTier: ApronTier;
  playersOut: number;
  // richer, optional (computed when data present)
  apronPostSalary?: number;
  capSpacePost?: number;
  hardCapLine?: number | null;
  generatedTpe?: number;
}

export interface TradeValidation {
  valid: boolean;
  perTeam: TeamResult[];
  errors: TradeFinding[]; // severity === 'block'
  warnings?: TradeFinding[]; // severity === 'warning'
  findings?: TradeFinding[]; // everything, all severities
}

// ----- Engine context consumed by rule modules -----
export type TradeMethod = 'simultaneous' | 'non_simultaneous';

export interface PerTeamContext extends TeamResult {
  preTradeSalary: number;
  apronSalary: number;
  outgoingMatch?: number; // outgoing salary for MATCHING purposes (base-year comp reduces it); = outgoing otherwise
  capSpace?: number;
  hardCapLine?: number | null;
  exceptions: TeamException[];
  rosterCount?: number;
  openRosterSpots?: number;
  twoWayCount?: number;
  toolsUsed?: ToolUsage[];
  priorSecondApronSeasons?: number;
  isRepeaterTaxpayer?: boolean;
  ownedFirstRoundPicks?: { year: number; conveyed?: boolean }[];
  outgoingAssets: TradeAsset[];
  incomingAssets: TradeAsset[];
}

export interface RuleContext {
  season: SeasonCap;
  matching: MatchingRules;
  apron: ApronRules;
  rules?: SeasonRules; // extended data (tax/calendar/scales) when available
  simulatedDate?: string; // ISO; for date-aware eligibility rules
  tradeMethod: TradeMethod;
  teams: PerTeamContext[];
  assets: TradeAsset[];
}

/** A pure CBA rule: reads the context, returns zero or more findings. */
export type Rule = (ctx: RuleContext) => TradeFinding[];

export interface TradeInput {
  season: SeasonCap;
  matching: MatchingRules;
  apron: ApronRules;
  teams: TradeTeamInput[];
  assets: TradeAsset[];
  rules?: SeasonRules;
  simulatedDate?: string;
  tradeMethod?: TradeMethod;
}
