import type { Metadata } from 'next';
import { getRoster, getSeasons, getTeams } from '@/lib/data/queries';
import { getRosterSnapshot } from '@/lib/data/rosterSnapshot';
import { contractRows } from '@/lib/data/contractsPortal';
import { ContractsPortal } from '@/components/ContractsPortal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'NBA player contracts & salaries | NBA Trade Machine',
  description: 'Search NBA player contracts, compare cap hits by season, and explore team and player options with source-dated contract notes.',
  alternates: { canonical: '/contracts' },
};

export default async function ContractsPage({searchParams}:{searchParams:Promise<{season?:string|string[]}>}) {
  const requested = (await searchParams).season;
  const [teams, reportedSeasons] = await Promise.all([getTeams(),getSeasons()]);
  // Only these roster snapshots have supported ownership; future salary columns are not future rosters.
  const seasons = ['2026-27','2025-26'].filter(season => reportedSeasons.includes(season));
  if (!seasons.includes('2026-27')) seasons.unshift('2026-27');
  const season = typeof requested === 'string' && seasons.includes(requested) ? requested : '2026-27';
  const [snapshot, rosterEntries] = await Promise.all([
    getRosterSnapshot(season),
    Promise.all(teams.map(async team => [team.id,await getRoster(team.id,season)] as const)),
  ]);
  return <ContractsPortal
    rows={contractRows(teams,Object.fromEntries(rosterEntries))}
    teams={teams.map(team => ({abbr:team.abbr,name:team.name}))}
    season={season}
    seasons={seasons}
    asOf={snapshot?.rosterAsOf}
    sourceVersion={snapshot?.version}
  />;
}
