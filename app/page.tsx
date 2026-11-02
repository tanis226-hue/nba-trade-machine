import { getTeams, getRoster, getSeasons, getDraftPicks, getPlayerValues, getFreeAgents, getTeamExceptions, getProjectedRecords } from '@/lib/data/queries';
import { TradeBoard } from '@/components/TradeBoard';
import { DataFreshness } from '@/components/DataFreshness';
import { getRosterSnapshot } from '@/lib/data/rosterSnapshot';

export const dynamic = 'force-dynamic';

// "2026-27" -> "2025-26": the season whose expiring deals make this season's free agents.
function priorSeasonOf(season: string): string {
  const y = parseInt(season.slice(0, 4), 10);
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

export default async function Home({searchParams}:{searchParams:Promise<{season?:string}>}) {
  const requested=(await searchParams).season;
  const [teams, seasons] = await Promise.all([getTeams(), getSeasons()]);
  const season = requested&&seasons.includes(requested)?requested:seasons.includes('2026-27')?'2026-27':seasons[0];
  const snapshot=await getRosterSnapshot(season);
  const rosters = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getRoster(t.id, season)] as const)),
  );
  const picks = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getDraftPicks(t.id,season)] as const)),
  );
  const [values, freeAgents, exceptions, projectedRecords] = await Promise.all([
    getPlayerValues(),
    getFreeAgents(season, priorSeasonOf(season)),
    getTeamExceptions(season),
    getProjectedRecords(season),
  ]);
  return (
    <main>
      <section id="how-it-works" className="builder-intro">
        <div>
          <p className="intro-season">NBA trade playground <span>{season}</span></p>
          <h1>Make your next big move.</h1>
          <p className="intro-description">Your teams. Your trade ideas. See how the salaries fit, find what needs to change, and send the deal to your group chat.</p>
        </div>
        <ol className="intro-steps" aria-label="How to build a trade">
          <li><span>1</span><div><strong>Pick your teams</strong><p>Start with two. Bring in up to seven.</p></div></li>
          <li><span>2</span><div><strong>Build the deal</strong><p>Send players, add picks, check the fit.</p></div></li>
          <li><span>3</span><div><strong>Get the conversation going</strong><p>Share a saved proposal. No account needed.</p></div></li>
        </ol>
      </section>
      <div className="mb-5">
        <DataFreshness snapshot={snapshot?{rosterAsOf:snapshot.rosterAsOf,pickAsOf:snapshot.pickAsOf,loadedFrom:snapshot.loadedFrom,importedAt:snapshot.importedAt}:undefined} />
      </div>
      <TradeBoard requestedSeason={requested && seasons.includes(requested) ? requested : undefined} teams={teams} rosters={rosters} seasons={seasons} rosterSeason={season} payroll={snapshot?.teams} dataVersion={snapshot?.version} defaultDate={snapshot?.rosterAsOf??'2026-06-01'} picks={picks} values={values} freeAgents={freeAgents} exceptions={exceptions} projectedRecords={projectedRecords} />
    </main>
  );
}
