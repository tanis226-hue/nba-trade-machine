// Sanity + accuracy report over the merged dataset (seed < scrape < override).
// Prints the top-N current-season salaries for eyeball cross-check vs HoopsHype/Spotrac,
// per-team totals and roster sizes, plus structural flags. Run: npx tsx scripts/audit.ts
import { localTeams, localRoster } from '@/lib/data/local';
import { SEASON_2026_27 } from '@/lib/cba/constants';

const SEASON = process.argv[2] ?? SEASON_2026_27.season;
const fmt = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

function main() {
  const teams = localTeams();
  const all = teams.flatMap((t) => localRoster(t.id, SEASON).map((r) => ({ team: t.abbr, ...r })));

  const empty = teams.filter((t) => localRoster(t.id, SEASON).length === 0);
  const dupes = new Map<string, number>();
  all.forEach((r) => dupes.set(r.playerId, (dupes.get(r.playerId) ?? 0) + 1));
  const duplicated = [...dupes.entries()].filter(([, n]) => n > 1);

  const invalid = all.filter((r) => !Number.isFinite(r.salary) || r.salary <= 0);
  console.log(`Season: ${SEASON}  Teams: ${teams.length}  Players: ${all.length}  Empty rosters: ${empty.length}`);
  if (empty.length) console.log('  EMPTY:', empty.map((t) => t.abbr).join(', '));
  if (duplicated.length) console.log('  DUPLICATE playerIds:', duplicated.map(([id]) => id).join(', '));
  if (invalid.length) console.log('  INVALID salaries:', invalid.map((r) => r.playerId).join(', '));

  console.log(`\nTop 30 ${SEASON} salaries (verify each vs a second source):`);
  all
    .sort((a, b) => b.salary - a.salary)
    .slice(0, 30)
    .forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${fmt(r.salary).padStart(9)}  ${r.name} (${r.team})`));

  const perTeam = teams.map((t) => {
    const roster = localRoster(t.id, SEASON);
    return { abbr: t.abbr, count: roster.length, total: roster.reduce((s, r) => s + r.salary, 0) };
  });
  console.log('\nTeam totals (sanity - most teams $120M-$220M, 13-18 players):');
  perTeam
    .sort((a, b) => b.total - a.total)
    .forEach((t) => {
      const flag = t.count < 12 || t.count > 18 ? '  <-- roster size' : '';
      console.log(`  ${t.abbr}  ${fmt(t.total).padStart(9)}  ${String(t.count).padStart(2)}p${flag}`);
    });

  if (teams.length !== 30 || empty.length || duplicated.length || invalid.length) {
    console.error('\nAUDIT FAILED: expected 30 populated teams, unique players, and valid salaries.');
    process.exit(1);
  }
  console.log('\nStructural checks passed. This does not certify current rosters, active counts, or source accuracy.');
}
main();
