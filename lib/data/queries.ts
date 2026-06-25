import { nanoid } from 'nanoid';
import { db, hasDb } from './db';
import { normalizePlayerId } from '@/lib/slug';
import type { DbTeam, DbSeasonCap, RosterEntry, ContractYear, DbDraftPick, DbPlayerValue, DbPlayerBio } from './types';
import {
  localSeasons, localTeams, localRoster, localDraftPicks, localPlayerValues, localPlayerBios, localSaveTrade, localGetTrade,
  localFreeAgents, localTeamExceptions, localProjectedRecords,
} from './local';
import type { TeamException } from '@/lib/cba/types';
import type { DbTeamException } from './types';

export interface PlayerMeta {
  value: number; pts: number; reb: number; ast: number;
  position?: string | null; height?: string | null; weight?: number | null; jersey?: string | null;
  age?: number | null; headshot?: string;
}
export type PlayerValueMap = Record<string, PlayerMeta>;

/** Official NBA headshot CDN, keyed by person id. */
export const headshotUrl = (nbaId: number) => `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;

export async function getPlayerValues(): Promise<PlayerValueMap> {
  const values = !hasDb()
    ? localPlayerValues()
    : await (async () => {
        try { return (await db()`SELECT player_id, pts, reb, ast, value FROM player_value`) as unknown as DbPlayerValue[]; }
        catch { return localPlayerValues(); }
      })();
  const bios = !hasDb()
    ? localPlayerBios()
    : await (async () => {
        try { return (await db()`SELECT player_id, nba_id, position, height, weight, jersey, age FROM player_bio`) as unknown as DbPlayerBio[]; }
        catch { return localPlayerBios(); } // e.g. age column not yet migrated → seed fallback (which has it)
      })();

  const map: PlayerValueMap = {};
  for (const r of values) {
    map[r.player_id] = { value: Number(r.value ?? 0), pts: Number(r.pts ?? 0), reb: Number(r.reb ?? 0), ast: Number(r.ast ?? 0) };
  }
  for (const b of bios) {
    // Bios share the value source's slugs; fall back to the tolerant key so a bio whose id differs
    // only by suffix/diacritic still lands on the right value entry.
    const e = map[b.player_id] ?? map[normalizePlayerId(b.player_id)] ?? (map[b.player_id] = { value: 0, pts: 0, reb: 0, ast: 0 });
    e.position = b.position; e.height = b.height; e.weight = b.weight; e.jersey = b.jersey; e.age = b.age;
    if (b.nba_id) e.headshot = headshotUrl(Number(b.nba_id));
  }
  // Alias each entry under its normalized key so roster ids that slugged differently (e.g.
  // `p_jimmy_butler` vs `p_jimmy_butler_iii`) still resolve. Exact ids keep priority.
  for (const [id, meta] of Object.entries(map)) {
    const nk = normalizePlayerId(id);
    if (nk && !(nk in map)) map[nk] = meta;
  }
  return map;
}

export async function getSeasons(): Promise<string[]> {
  if (!hasDb()) return localSeasons();
  const rows = await db()`SELECT season FROM season_cap ORDER BY season`;
  return rows.map((r) => r.season as string);
}

export async function getTeams(): Promise<DbTeam[]> {
  if (!hasDb()) return localTeams();
  const rows = await db()`
    SELECT id, name, abbr, conference, logo_url, primary_color, secondary_color
    FROM teams ORDER BY name`;
  return rows as DbTeam[];
}

export async function getSeasonCap(season: string): Promise<DbSeasonCap> {
  const rows = await db()`
    SELECT season, salary_cap::int AS salary_cap, tax_line::int AS tax_line,
      first_apron::int AS first_apron, second_apron::int AS second_apron,
      min_team_salary::int AS min_team_salary
    FROM season_cap WHERE season = ${season}`;
  const cap = rows[0];
  if (!cap) throw new Error(`no season_cap for ${season}`);
  return cap as DbSeasonCap;
}

export async function getRoster(teamId: string, season: string): Promise<RosterEntry[]> {
  if (!hasDb()) return localRoster(teamId, season);
  const rows = await db()`
    SELECT p.id, p.name, p.position, p.age,
      COALESCE(
        json_agg(
          json_build_object(
            'season', c.season, 'salary', c.salary::int, 'option_type', c.option_type,
            'guarantee_status', c.guarantee_status, 'no_trade_clause', c.no_trade_clause,
            'trade_bonus_pct', c.trade_bonus_pct, 'trade_bonus_earned', c.trade_bonus_earned
          ) ORDER BY c.season
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS contract
    FROM players p
    LEFT JOIN contracts c ON c.player_id = p.id
    WHERE p.team_id = ${teamId}
    GROUP BY p.id, p.name, p.position, p.age`;
  return (rows as { id: string; name: string; position: string | null; age: number | null; contract: ContractYear[] }[])
    .map((p) => {
      const contract = p.contract ?? [];
      const cur = contract.find((c) => c.season === season);
      return { playerId: p.id, name: p.name, position: p.position, age: p.age, salary: cur?.salary ?? 0, contract };
    })
    .filter((r) => r.salary > 0);
}

export interface FreeAgentRow {
  playerId: string;
  name: string;
  priorTeamId: string | null;
  priorSalary: number; // last on-the-books cap hit
  restricted: boolean; // RFA heuristic (≤3 yrs of service); refine when YOS is populated
}

/**
 * Free agents for `season`: players who have a contract in `priorSeason` but none in `season`.
 * These are dropped from rosters (which require a current-season salary), so they need their own
 * query to power free-agent signing. Degrades to the local seed/scrape fallback on any DB error.
 */
export async function getFreeAgents(season: string, priorSeason: string): Promise<FreeAgentRow[]> {
  if (!hasDb()) return localFreeAgents(season, priorSeason);
  try {
    const rows = await db()`
      SELECT p.id AS player_id, p.name, p.team_id AS prior_team_id, p.years_of_service AS yos,
        MAX(prev.salary)::int AS prior_salary
      FROM players p
      JOIN contracts prev ON prev.player_id = p.id AND prev.season = ${priorSeason}
      WHERE NOT EXISTS (SELECT 1 FROM contracts cur WHERE cur.player_id = p.id AND cur.season = ${season})
      GROUP BY p.id, p.name, p.team_id, p.years_of_service
      ORDER BY prior_salary DESC NULLS LAST`;
    return (rows as { player_id: string; name: string; prior_team_id: string | null; yos: number | null; prior_salary: number | null }[])
      .map((r) => ({
        playerId: r.player_id,
        name: r.name,
        priorTeamId: r.prior_team_id,
        priorSalary: Number(r.prior_salary ?? 0),
        restricted: r.yos != null && r.yos <= 3,
      }));
  } catch {
    return localFreeAgents(season, priorSeason);
  }
}

export interface TeamExceptionView extends TeamException {
  sourcePlayer?: string | null;
}

/** Per-team trade exceptions (TPE/MLE/BAE/room) for the season, keyed by team id. Degrades to seed. */
export async function getTeamExceptions(season: string): Promise<Record<string, TeamExceptionView[]>> {
  const rows: DbTeamException[] = !hasDb()
    ? localTeamExceptions(season)
    : await (async () => {
        try {
          return (await db()`SELECT id, team_id, season, kind, amount::int AS amount, expires_date::text AS expires_date, source_player
            FROM team_exceptions WHERE season = ${season}`) as unknown as DbTeamException[];
        } catch {
          return localTeamExceptions(season);
        }
      })();
  const map: Record<string, TeamExceptionView[]> = {};
  for (const r of rows) {
    (map[r.team_id] ??= []).push({
      kind: r.kind as TeamException['kind'],
      amount: Number(r.amount),
      expires: r.expires_date ?? undefined,
      createdFromSignAndTrade: false,
      sourcePlayer: r.source_player ?? undefined,
    });
  }
  return map;
}

export interface ProjectedRecord {
  teamId: string;
  wins: number;
  losses: number;
  winPct: number;
  projectedSlot: number; // expected first-round draft slot (1 = worst record), a proxy for pick value + conveyance
}

/** Projected (or prior-season) records keyed by team id. Each team's expected first-round draft slot
 *  is derived by ranking win% ascending (worst record => slot 1), the input pick value + conveyance need.
 *  Degrades to {} when no data is present. */
export async function getProjectedRecords(season: string): Promise<Record<string, ProjectedRecord>> {
  let rows: { team_id: string; wins: number | null; losses: number | null }[] = [];
  if (!hasDb()) {
    rows = localProjectedRecords(season);
  } else {
    try {
      rows = (await db()`SELECT team_id, wins, losses FROM team_projected_record WHERE season = ${season}`) as unknown as typeof rows;
    } catch {
      rows = localProjectedRecords(season);
    }
  }
  if (!rows.length) rows = localProjectedRecords(season);

  const recs = rows.map((r) => {
    const w = Number(r.wins ?? 0);
    const l = Number(r.losses ?? 0);
    return { teamId: r.team_id, wins: w, losses: l, winPct: w + l > 0 ? w / (w + l) : 0 };
  });
  const slotByTeam = new Map([...recs].sort((a, b) => a.winPct - b.winPct).map((t, i) => [t.teamId, i + 1] as const));
  const map: Record<string, ProjectedRecord> = {};
  for (const t of recs) map[t.teamId] = { ...t, projectedSlot: slotByTeam.get(t.teamId) ?? 30 };
  return map;
}

export async function getDraftPicks(teamId: string): Promise<DbDraftPick[]> {
  if (!hasDb()) return localDraftPicks(teamId);
  try {
    const rows = await db()`
      SELECT id, owning_team_id, original_team_id, season, round, protections, is_swap, is_frozen, conveyed, swap_direction
      FROM draft_picks WHERE owning_team_id = ${teamId}
      ORDER BY season, round`;
    if (rows.length) return rows as DbDraftPick[];
  } catch {
    // draft_picks not yet migrated/seeded in this DB — fall through to the seed baseline.
  }
  return localDraftPicks(teamId); // every team owns its own future picks until overrides say otherwise
}

export interface TradePayload {
  season: string;
  teams: unknown;
  assets: unknown;
  contracts?: unknown;
  // Captured so a reopened/shared trade re-validates exactly as the author saw it (date-aware
  // eligibility keys off simulatedDate; the matching path differs for simultaneous vs TPE).
  simulatedDate?: string;
  tradeMethod?: string;
}

export async function saveTrade(payload: TradePayload): Promise<string> {
  const slug = nanoid(10);
  if (!hasDb()) {
    localSaveTrade(slug, payload);
    return slug;
  }
  await db()`INSERT INTO trades (id, slug, payload) VALUES (${slug}, ${slug}, ${JSON.stringify(payload)}::jsonb)`;
  return slug;
}

export async function getTrade(slug: string): Promise<TradePayload | null> {
  if (!hasDb()) return localGetTrade(slug) as TradePayload | null;
  const rows = await db()`SELECT payload FROM trades WHERE slug = ${slug}`;
  return rows[0] ? (rows[0].payload as TradePayload) : null;
}

export interface UserTradeListItem {
  slug: string;
  title: string;
  season: string;
  updatedAt: string;
}

// Save a trade under a signed-in user. A fresh save mints a slug; passing a slug the user already
// owns overwrites that row in place (rename + new payload). The ON CONFLICT guard keys on user_id
// so a guessed slug can never clobber another user's (or an anonymous) saved trade. Returns the slug.
export async function saveUserTrade(args: {
  userId: string;
  title: string;
  payload: TradePayload;
  slug?: string;
}): Promise<string> {
  if (!hasDb()) throw new Error('Saving to an account requires the database');
  const slug = args.slug ?? nanoid(10);
  const title = args.title.trim().slice(0, 120) || 'Untitled trade';
  await db()`
    INSERT INTO trades (id, slug, payload, user_id, title, updated_at)
    VALUES (${slug}, ${slug}, ${JSON.stringify(args.payload)}::jsonb, ${args.userId}, ${title}, now())
    ON CONFLICT (slug) DO UPDATE
      SET payload = excluded.payload, title = excluded.title, updated_at = now()
      WHERE trades.user_id = ${args.userId}
  `;
  return slug;
}

export async function listUserTrades(userId: string): Promise<UserTradeListItem[]> {
  if (!hasDb()) return [];
  const rows = await db()`
    SELECT slug, coalesce(title, 'Untitled trade') AS title, payload->>'season' AS season, updated_at
    FROM trades WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows.map((r) => ({
    slug: r.slug as string,
    title: r.title as string,
    season: (r.season as string) ?? '',
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

export async function deleteUserTrade(userId: string, slug: string): Promise<void> {
  if (!hasDb()) return;
  await db()`DELETE FROM trades WHERE slug = ${slug} AND user_id = ${userId}`;
}
