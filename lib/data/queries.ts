import { nanoid } from 'nanoid';
import { createSupabase } from './supabase';
import type { DbTeam, DbSeasonCap, RosterEntry } from './types';

export async function getSeasons(): Promise<string[]> {
  const { data, error } = await createSupabase().from('season_cap').select('season').order('season');
  if (error) throw error;
  return data.map((r) => r.season);
}

export async function getTeams(): Promise<DbTeam[]> {
  const { data, error } = await createSupabase().from('teams').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getSeasonCap(season: string): Promise<DbSeasonCap> {
  const { data, error } = await createSupabase().from('season_cap').select('*').eq('season', season).single();
  if (error) throw error;
  return data;
}

export async function getRoster(teamId: string, season: string): Promise<RosterEntry[]> {
  const { data, error } = await createSupabase()
    .from('players')
    .select('id, name, position, age, contracts(season, salary, option_type, guarantee_status, no_trade_clause)')
    .eq('team_id', teamId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contract = ((p.contracts ?? []) as any[]).sort((a, b) => a.season.localeCompare(b.season));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cur = contract.find((c: any) => c.season === season);
      return {
        playerId: p.id,
        name: p.name,
        position: p.position,
        age: p.age,
        salary: cur?.salary ?? 0,
        contract,
      };
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
  const { error } = await createSupabase().from('trades').insert({ id: slug, slug, payload });
  if (error) throw error;
  return slug;
}

export async function getTrade(slug: string): Promise<TradePayload | null> {
  const { data, error } = await createSupabase().from('trades').select('payload').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? (data.payload as TradePayload) : null;
}
