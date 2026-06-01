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
