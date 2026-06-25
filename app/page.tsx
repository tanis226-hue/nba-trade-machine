import { getTeams, getRoster, getSeasons, getDraftPicks, getPlayerValues, getFreeAgents, getTeamExceptions, getProjectedRecords } from '@/lib/data/queries';
import { TradeBoard } from '@/components/TradeBoard';
import { DataFreshness } from '@/components/DataFreshness';

export const dynamic = 'force-dynamic';

// "2026-27" -> "2025-26": the season whose expiring deals make this season's free agents.
function priorSeasonOf(season: string): string {
  const y = parseInt(season.slice(0, 4), 10);
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

export default async function Home() {
  const [teams, seasons] = await Promise.all([getTeams(), getSeasons()]);
  const season = seasons.includes('2026-27') ? '2026-27' : seasons[0];
  const rosters = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getRoster(t.id, season)] as const)),
  );
  const picks = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getDraftPicks(t.id)] as const)),
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
          <span className="h-px w-8 bg-[var(--accent)]" /> Live {season} apron engine
        </div>
        <h1 className="mt-3 font-display text-6xl font-extrabold uppercase leading-[0.8] tracking-[-0.01em] text-[var(--text)] sm:text-7xl lg:text-[5.6rem]">
          Build the
          <br />
          <span className="text-[var(--accent)]">trade</span>
          <span className="text-[var(--accent-2)]">.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Mock up 2-7 team deals with real {season} contracts and picks, plus instant 2023-CBA validation:
          salary matching, luxury tax, first / second apron, hard caps, and trade exceptions, recalculated the
          moment you move a player or a pick.
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
      <TradeBoard teams={teams} rosters={rosters} seasons={seasons} picks={picks} values={values} freeAgents={freeAgents} exceptions={exceptions} projectedRecords={projectedRecords} />
      <div className="mt-5">
        <DataFreshness />
      </div>
    </main>
  );
}
