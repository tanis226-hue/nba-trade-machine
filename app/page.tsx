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
    <main className="rise">
      <section className="mb-7">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--legal)]" /> Live {season} apron engine
        </div>
        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-[var(--text)] sm:text-6xl">
          Build the <span className="text-[var(--accent)]">trade</span>.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Mock up 2-4 team deals with real contracts and instant CBA validation: salary matching,
          luxury tax, and first / second apron rules, calculated the moment you move a player.
        </p>
      </section>
      <TradeBoard teams={teams} rosters={rosters} seasons={seasons} />
    </main>
  );
}
