// Filesystem fallback data provider. Used when Supabase env vars are absent so the app
// runs out-of-the-box for local dev/demos. Mirrors the merge precedence of scripts/import.ts
// (seed < scraper out < override). Production uses Supabase via queries.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { DbTeam, DbSeasonCap, RosterEntry, ContractYear } from './types';

const root = process.cwd();
const LAYERS = [
  path.join(root, 'data/seed'),
  path.join(root, 'scripts/scraper/out'),
  path.join(root, 'data/overrides'),
];

function read<T>(file: string, key: (row: T) => string): T[] {
  const m = new Map<string, T>();
  for (const dir of LAYERS) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) continue;
    for (const row of JSON.parse(fs.readFileSync(p, 'utf8')) as T[]) m.set(key(row), row);
  }
  return [...m.values()];
}

export function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function localSeasons(): string[] {
  return read<DbSeasonCap>('season_cap.json', (s) => s.season)
    .map((s) => s.season)
    .sort();
}

export function localTeams(): DbTeam[] {
  return read<DbTeam>('teams.json', (t) => t.id).sort((a, b) => a.name.localeCompare(b.name));
}

interface LocalPlayer {
  id: string;
  name: string;
  position: string | null;
  team_id: string;
  age: number | null;
}
interface LocalContract {
  id: string;
  player_id: string;
  season: string;
  salary: number;
  option_type: string;
  guarantee_status: string;
  no_trade_clause: boolean;
}

export function localRoster(teamId: string, season: string): RosterEntry[] {
  const players = read<LocalPlayer>('players.json', (p) => p.id).filter((p) => p.team_id === teamId);
  const contracts = read<LocalContract>('contracts.json', (c) => c.id);
  return players
    .map((p) => {
      const contract: ContractYear[] = contracts
        .filter((c) => c.player_id === p.id)
        .sort((a, b) => a.season.localeCompare(b.season))
        .map((c) => ({
          season: c.season,
          salary: c.salary,
          option_type: c.option_type,
          guarantee_status: c.guarantee_status,
          no_trade_clause: c.no_trade_clause,
        }));
      const cur = contract.find((c) => c.season === season);
      return { playerId: p.id, name: p.name, position: p.position, age: p.age, salary: cur?.salary ?? 0, contract };
    })
    .filter((r) => r.salary > 0);
}

// File-backed trade store for shared links when there is no database (dev only).
// A file (not in-memory) so it survives across Next's separate route/page module graphs.
const TRADE_DIR = path.join(root, '.trades');

export function localSaveTrade(slug: string, payload: unknown): void {
  fs.mkdirSync(TRADE_DIR, { recursive: true });
  fs.writeFileSync(path.join(TRADE_DIR, `${slug}.json`), JSON.stringify(payload), 'utf8');
}
export function localGetTrade(slug: string): unknown {
  const p = path.join(TRADE_DIR, `${slug}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
