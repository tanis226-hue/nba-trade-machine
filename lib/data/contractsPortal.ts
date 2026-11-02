import type { ContractYear, DbTeam, RosterEntry } from './types';

export interface ContractPortalRow {
  id: string;
  playerId: string;
  name: string;
  teamId: string;
  teamAbbr: string;
  teamName: string;
  position: string | null;
  salary: number;
  contract: ContractYear[];
  isTwoWay: boolean;
  headshot?: string | null;
  source?: string;
  notes: string[];
}

export interface ContractFilters {
  query: string;
  team: string;
  position: string;
  feature: string;
  sort: 'salary' | 'name' | 'team' | 'commitments';
  year: string;
  direction: 'asc' | 'desc';
}

export function contractRows(teams: DbTeam[], rosters: Record<string, RosterEntry[]>): ContractPortalRow[] {
  return teams.flatMap(team => (rosters[team.id] ?? []).map(player => ({
    id: `${team.abbr}-${player.playerId}`,
    playerId: player.playerId,
    name: player.name,
    teamId: team.id,
    teamAbbr: team.abbr,
    teamName: team.name,
    position: player.position,
    salary: player.salary,
    contract: [...player.contract].sort((a,b) => a.season.localeCompare(b.season)),
    isTwoWay: player.isTwoWay === true,
    headshot: player.headshot,
    source: player.source,
    notes: player.dataNotes ?? [],
  })));
}

export function listedSeasons(rows: ContractPortalRow[], baseSeason: string): string[] {
  return [...new Set([baseSeason, ...rows.flatMap(row => row.contract.map(year => year.season))])]
    .filter(season => season >= baseSeason).sort();
}

/** These are listed cap hits, including options; never a guaranteed-money calculation. */
export function listedCommitments(row: ContractPortalRow, baseSeason: string): number {
  const years = row.contract.filter(year => year.season >= baseSeason);
  const currentFallback = years.some(year => year.season === baseSeason) ? 0 : row.salary;
  return years.reduce((total,year) => total + year.salary, currentFallback);
}

export function salaryFor(row: ContractPortalRow, year: string, baseSeason: string): number | null {
  return row.contract.find(contract => contract.season === year)?.salary ?? (year === baseSeason ? row.salary : null);
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export function guaranteeLabel(status: string | null | undefined): string {
  if (status === 'full' || status === 'fully_guaranteed') return 'Fully guaranteed (reported)';
  if (status === 'partial' || status === 'partially_guaranteed') return 'Partially guaranteed; amount not supplied';
  if (status === 'non_guaranteed') return 'Non-guaranteed';
  return 'Guarantee not reported';
}

export function filterContracts(rows: ContractPortalRow[], filters: ContractFilters, baseSeason: string): ContractPortalRow[] {
  const query = normalize(filters.query);
  return rows.filter(row => {
    if (query && !normalize(row.name).includes(query)) return false;
    if (filters.team && row.teamAbbr !== filters.team) return false;
    if (filters.position && !row.position?.split(/[,/\s]+/).includes(filters.position)) return false;
    const years = row.contract.filter(year => year.season >= baseSeason);
    if (filters.feature === 'player_option' && !years.some(year => year.option_type === 'player')) return false;
    if (filters.feature === 'team_option' && !years.some(year => year.option_type === 'team')) return false;
    if (filters.feature === 'non_guaranteed' && !years.some(year => year.guarantee_status === 'non_guaranteed')) return false;
    if (filters.feature === 'partial' && !years.some(year => year.guarantee_status === 'partial' || year.guarantee_status === 'partially_guaranteed')) return false;
    if (filters.feature === 'no_trade' && !years.some(year => year.no_trade_clause)) return false;
    if (filters.feature === 'two_way' && !row.isTwoWay) return false;
    return true;
  }).sort((a,b) => {
    let comparison = 0;
    if (filters.sort === 'name') comparison = a.name.localeCompare(b.name);
    else if (filters.sort === 'team') comparison = a.teamName.localeCompare(b.teamName);
    else if (filters.sort === 'commitments') comparison = listedCommitments(a,baseSeason) - listedCommitments(b,baseSeason);
    else {
      const aSalary = salaryFor(a,filters.year,baseSeason), bSalary = salaryFor(b,filters.year,baseSeason);
      // An unlisted future salary is unknown, not $0; keep it last in either direction.
      if (aSalary === null && bSalary !== null) return 1;
      if (aSalary !== null && bSalary === null) return -1;
      comparison = (aSalary ?? 0) - (bSalary ?? 0);
    }
    return (filters.direction === 'asc' ? comparison : -comparison) || a.name.localeCompare(b.name);
  });
}
