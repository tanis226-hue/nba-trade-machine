import { getTeams, getRoster, getDraftPicks, getPlayerValues } from '@/lib/data/queries';
import type { RosterEntry } from '@/lib/data/types';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

const SEASON = '2026-27';
const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const ESPN: Record<string, string> = { GSW: 'gs', NOP: 'no', NYK: 'ny', SAS: 'sa', UTA: 'utah', WAS: 'wsh' };
const teamLogo = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${(ESPN[abbr] ?? abbr).toLowerCase()}.png`;

async function resolveTeam(abbr: string) {
  const teams = await getTeams();
  const target = abbr.toLowerCase();
  return teams.find((t) => t.abbr.toLowerCase() === target) ?? null;
}

function contractYears(entry: RosterEntry): number {
  return entry.contract.filter((c) => c.salary > 0).length || 1;
}

export async function generateStaticParams() {
  const teams = await getTeams();
  return teams.map((t) => ({ abbr: t.abbr.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ abbr: string }> }): Promise<Metadata> {
  const { abbr } = await params;
  const team = await resolveTeam(abbr);
  if (!team) return { title: 'Team not found | NBA Trade Machine' };
  const title = `${team.name} ${SEASON} Salary Cap, Roster & Trade Assets | NBA Trade Machine`;
  const description = `Explore the ${team.name} ${SEASON} salary cap sheet: full roster with salaries and contract years, total team salary, and tradeable draft picks. Build a trade involving the ${team.name} with real contracts and 2023-CBA validation.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    alternates: { canonical: `/team/${team.abbr.toLowerCase()}` },
  };
}

export default async function TeamPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const team = await resolveTeam(abbr);
  if (!team) notFound();

  const [roster, picks, values] = await Promise.all([getRoster(team.id, SEASON), getDraftPicks(team.id), getPlayerValues()]);

  const sorted = [...roster].sort((a, b) => b.salary - a.salary);
  const total = sorted.reduce((s, r) => s + r.salary, 0);
  const tradeablePicks = picks.filter((p) => !p.is_frozen && !p.conveyed);

  return (
    <main className="rise space-y-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={teamLogo(team.abbr)} alt={`${team.name} logo`} className="h-16 w-16 shrink-0 object-contain" />
        <div>
          <div className="eyebrow flex items-center gap-2.5">
            <span className="h-px w-6 bg-[var(--accent)]" /> {team.conference} · {SEASON} salary cap
          </div>
          <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-[var(--text)] sm:text-5xl">{team.name}</h1>
          <div className="mt-1 num text-sm text-[var(--muted)]">
            Total {SEASON} salary <span className="font-semibold text-[var(--text)]">{m(total)}</span> · {sorted.length} players
          </div>
        </div>
      </div>

      <section className="panel rounded-xl p-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text)]">Roster</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
                <th className="py-1 text-left font-medium">Player</th>
                <th className="py-1 text-right font-medium">{SEASON} Salary</th>
                <th className="py-1 text-right font-medium">Contract Yrs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.playerId} className="border-t border-[var(--border-soft)]">
                  <td className="py-1.5 text-[var(--text)]">
                    <span className="flex items-center gap-2.5">
                      {values[r.playerId]?.headshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={values[r.playerId].headshot} alt="" className="h-7 w-7 shrink-0 rounded-full bg-[var(--surface-2)] object-cover object-top ring-1 ring-[var(--border)]" />
                      ) : (
                        <span className="h-7 w-7 shrink-0 rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]" />
                      )}
                      <span>
                        {r.name}
                        {r.position && <span className="ml-2 text-xs text-[var(--faint)]">{r.position}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right num text-[var(--muted)]">{m(r.salary)}</td>
                  <td className="py-1.5 text-right num text-[var(--muted)]">{contractYears(r)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-[var(--faint)]">
                    No roster data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel rounded-xl p-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text)]">
          Tradeable Draft Picks
        </h2>
        {tradeablePicks.length === 0 ? (
          <div className="mt-2 text-sm text-[var(--faint)]">No tradeable picks on record.</div>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {tradeablePicks.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-t border-[var(--border-soft)] py-1.5">
                <span className="text-[var(--text)]">
                  {p.season} {p.round === 1 ? '1st' : '2nd'}-round pick
                  {p.is_swap && <span className="ml-2 text-xs text-[var(--faint)]">swap</span>}
                  {p.protections != null && <span className="ml-2 text-xs text-[var(--faint)]">protected</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/"
        className="inline-block font-display text-sm font-semibold uppercase tracking-wide text-[var(--accent)] hover:brightness-110"
      >
        Build a trade →
      </Link>
    </main>
  );
}
