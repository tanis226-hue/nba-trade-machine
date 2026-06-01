import { nanoid } from 'nanoid';
import { db, hasDb } from './db';
import type { DbTeam, DbSeasonCap, RosterEntry, ContractYear } from './types';
import { localSeasons, localTeams, localRoster, localSaveTrade, localGetTrade } from './local';

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
            'guarantee_status', c.guarantee_status, 'no_trade_clause', c.no_trade_clause
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

export interface TradePayload {
  season: string;
  teams: unknown;
  assets: unknown;
  contracts?: unknown;
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
