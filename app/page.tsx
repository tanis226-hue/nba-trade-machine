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
      <section className="stagger mb-9">
        <div className="eyebrow flex items-center gap-2.5">
          <span className="h-px w-8 bg-[var(--accent)]" /> {season} trade playground
        </div>
        <h1 className="mt-3 font-display text-6xl font-extrabold uppercase leading-[0.8] tracking-[-0.01em] text-[var(--text)] sm:text-7xl lg:text-[5.6rem]">
          Build the
          <br />
          <span className="text-[var(--accent)]">trade</span>
          <span className="text-[var(--accent-2)]">.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Build 2-7 team deals, explore the cap impact, and see what needs to change.
          Salary matching, apron checks, tax estimates, and rule explanations update as you move players and picks.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
          <span>
            <b className="text-[var(--text)]">30</b> teams
          </span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>
            <b className="text-[var(--text)]">real</b> game-score values
          </span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>
            <b className="text-[var(--text)]">cba-cited</b> verdicts
          </span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>
            <b className="text-[var(--text)]">picks · cash · tpe</b>
          </span>
        </div>
      </section>
      <div className="mb-5">
        <DataFreshness snapshot={snapshot?{rosterAsOf:snapshot.rosterAsOf,pickAsOf:snapshot.pickAsOf,loadedFrom:snapshot.loadedFrom,importedAt:snapshot.importedAt}:undefined} />
      </div>
      <TradeBoard teams={teams} rosters={rosters} seasons={seasons} rosterSeason={season} payroll={snapshot?.teams} dataVersion={snapshot?.version} defaultDate={snapshot?.rosterAsOf??'2026-06-01'} picks={picks} values={values} freeAgents={freeAgents} exceptions={exceptions} projectedRecords={projectedRecords} />
    </main>
  );
}
