export interface DbTeam {
  id: string;
  name: string;
  abbr: string;
  conference: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

export interface DbSeasonCap {
  season: string;
  salary_cap: number;
  tax_line: number;
  first_apron: number;
  second_apron: number;
  min_team_salary: number;
}

export interface ContractYear {
  season: string;
  salary: number;
  option_type: string;
  guarantee_status: string;
  no_trade_clause: boolean;
}

export interface RosterEntry {
  playerId: string;
  name: string;
  position: string | null;
  age: number | null;
  salary: number;
  contract: ContractYear[];
}

export interface DbPlayerValue {
  player_id: string;
  season: string;
  gp: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  value: number | null;
}

export interface DbPlayerBio {
  player_id: string;
  nba_id: number | null;
  position: string | null;
  height: string | null;
  weight: number | null;
  jersey: string | null;
  age: number | null;
}

export interface DbTeamException {
  id: string;
  team_id: string;
  season: string;
  kind: string; // tpe|non_taxpayer_mle|taxpayer_mle|room_mle|bae|room
  amount: number;
  expires_date: string | null;
  source_player?: string | null;
}

export interface DbDraftPick {
  id: string;
  owning_team_id: string;
  original_team_id: string;
  season: string; // draft year, e.g. "2026"
  round: number;
  protections: unknown | null;
  is_swap: boolean;
  is_frozen: boolean;
  conveyed?: boolean;
}
