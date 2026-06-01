import { getTeams, getRoster, getSeasons } from '@/lib/data/queries';
import { TradeBoard } from '@/components/TradeBoard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [teams, seasons] = await Promise.all([getTeams(), getSeasons()]);
  const season = seasons.includes('2025-26') ? '2025-26' : seasons[0];
  const rosters = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getRoster(t.id, season)] as const)),
  );
  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">NBA Trade Machine</h1>
        <p className="text-sm text-neutral-500">Fast, accurate multi-team trades with live {season} apron validation.</p>
      </header>
      <TradeBoard teams={teams} rosters={rosters} seasons={seasons} />
    </main>
  );
}
