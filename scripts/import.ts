import fs from 'node:fs';
import path from 'node:path';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const root = process.cwd();
const LAYERS = [
  path.join(root, 'data/seed'), // base
  path.join(root, 'scripts/scraper/out'), // scrape
  path.join(root, 'data/overrides'), // override (wins)
];

type Row = Record<string, unknown> & { id?: string; season?: string };

function read(dir: string, file: string): Row[] {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as Row[]) : [];
}

// Merge a table across all layers in order; later layers overwrite by key.
function merged(file: string, key: string): Row[] {
  const m = new Map<string, Row>();
  for (const dir of LAYERS) {
    for (const row of read(dir, file)) m.set(String(row[key]), row);
  }
  return [...m.values()];
}

interface Col {
  name: string;
  type: string;
}

// Bulk upsert via unnest(): one round-trip per table, idempotent on the conflict key.
async function upsert(
  sql: NeonQueryFunction<false, false>,
  table: string,
  cols: Col[],
  conflict: string,
  rows: Row[],
): Promise<void> {
  if (!rows.length) {
    console.log(`skip ${table} (no rows)`);
    return;
  }
  const names = cols.map((c) => c.name);
  const selects = cols.map((c, i) => `$${i + 1}::${c.type}[]`).join(', ');
  const updates = names
    .filter((n) => n !== conflict)
    .map((n) => `${n} = excluded.${n}`)
    .join(', ');
  const query = `INSERT INTO ${table} (${names.join(', ')})
    SELECT * FROM unnest(${selects})
    ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`;
  const params = cols.map((c) =>
    rows.map((r) => {
      const v = r[c.name] ?? null;
      // jsonb array params must be JSON text so Postgres parses each element through ::jsonb[].
      return c.type === 'jsonb' && v != null ? JSON.stringify(v) : v;
    }),
  );
  await sql.query(query, params);
  console.log(`upserted ${rows.length} into ${table}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (or NETLIFY_DATABASE_URL) to the Neon connection string');
  const sql = neon(url);

  // Order matters for FK integrity: cap/teams -> players -> contracts.
  await upsert(
    sql,
    'season_cap',
    [
      { name: 'season', type: 'text' },
      { name: 'salary_cap', type: 'bigint' },
      { name: 'tax_line', type: 'bigint' },
      { name: 'first_apron', type: 'bigint' },
      { name: 'second_apron', type: 'bigint' },
      { name: 'min_team_salary', type: 'bigint' },
    ],
    'season',
    merged('season_cap.json', 'season'),
  );
  await upsert(
    sql,
    'teams',
    [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'abbr', type: 'text' },
      { name: 'conference', type: 'text' },
      { name: 'logo_url', type: 'text' },
      { name: 'primary_color', type: 'text' },
      { name: 'secondary_color', type: 'text' },
    ],
    'id',
    merged('teams.json', 'id'),
  );
  await upsert(
    sql,
    'players',
    [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'position', type: 'text' },
      { name: 'team_id', type: 'text' },
      { name: 'age', type: 'int' },
      { name: 'years_of_service', type: 'int' },
    ],
    'id',
    merged('players.json', 'id'),
  );

  // Years of service: UPDATE only this column (from data/seed/player_yos.json, produced by the stats
  // pull) so a player's team/position stay sourced from the live scrape rather than frozen here.
  const yosRows = merged('player_yos.json', 'player_id').filter((r) => r.player_id != null);
  if (yosRows.length) {
    const ids = yosRows.map((r) => String(r.player_id));
    const yos = yosRows.map((r) => Number(r.years_of_service ?? 0));
    await sql.query(
      `UPDATE players p SET years_of_service = v.yos
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::int[]) AS yos) v
       WHERE p.id = v.id`,
      [ids, yos],
    );
    console.log(`updated years_of_service for ${ids.length} players`);
  }

  await upsert(
    sql,
    'contracts',
    [
      { name: 'id', type: 'text' },
      { name: 'player_id', type: 'text' },
      { name: 'season', type: 'text' },
      { name: 'salary', type: 'bigint' },
      { name: 'option_type', type: 'text' },
      { name: 'guarantee_status', type: 'text' },
      { name: 'no_trade_clause', type: 'boolean' },
      { name: 'trade_bonus_pct', type: 'numeric' },
      { name: 'source', type: 'text' },
    ],
    'id',
    merged('contracts.json', 'id'),
  );

  // New tables (present after migration 0002). Tolerate a pre-0002 DB so the core import still succeeds.
  try {
    // draft_picks is a full-replace dataset (researched ownership), so clear stale rows before reloading.
    await sql`DELETE FROM draft_picks`;
    await upsert(
      sql,
      'draft_picks',
      [
        { name: 'id', type: 'text' },
        { name: 'owning_team_id', type: 'text' },
        { name: 'original_team_id', type: 'text' },
        { name: 'season', type: 'text' },
        { name: 'round', type: 'int' },
        { name: 'is_swap', type: 'boolean' },
        { name: 'is_frozen', type: 'boolean' },
        { name: 'conveyed', type: 'boolean' },
        { name: 'protections', type: 'jsonb' },
      ],
      'id',
      merged('draft_picks.json', 'id'),
    );
  } catch (e) {
    console.warn('skip draft_picks (run migrate first to create the 0002 columns):', (e as Error).message);
  }

  // team_exceptions: curated TPE/MLE/BAE/room inventory (full-replace).
  try {
    await sql`DELETE FROM team_exceptions`;
    await upsert(
      sql,
      'team_exceptions',
      [
        { name: 'id', type: 'text' },
        { name: 'team_id', type: 'text' },
        { name: 'season', type: 'text' },
        { name: 'kind', type: 'text' },
        { name: 'amount', type: 'bigint' },
        { name: 'expires_date', type: 'date' },
        { name: 'source_player', type: 'text' },
      ],
      'id',
      merged('team_exceptions.json', 'id'),
    );
  } catch (e) {
    console.warn('skip team_exceptions (run migrate first for 0008):', (e as Error).message);
  }

  // team_projected_record: projected (or prior-season) W-L per team, used to value picks by the
  // owner's expected draft slot and to resolve conveyance/swaps. Full-replace.
  try {
    await sql`DELETE FROM team_projected_record`;
    await upsert(
      sql,
      'team_projected_record',
      [
        { name: 'team_id', type: 'text' },
        { name: 'season', type: 'text' },
        { name: 'wins', type: 'int' },
        { name: 'losses', type: 'int' },
      ],
      'team_id, season',
      merged('team_projected_record.json', 'team_id'),
    );
  } catch (e) {
    console.warn('skip team_projected_record:', (e as Error).message);
  }

  try {
    await upsert(
      sql,
      'player_value',
      [
        { name: 'player_id', type: 'text' },
        { name: 'season', type: 'text' },
        { name: 'gp', type: 'int' },
        { name: 'pts', type: 'numeric' },
        { name: 'reb', type: 'numeric' },
        { name: 'ast', type: 'numeric' },
        { name: 'value', type: 'numeric' },
      ],
      'player_id',
      merged('player_value.json', 'player_id'),
    );
  } catch (e) {
    console.warn('skip player_value (run migrate first to create 0004):', (e as Error).message);
  }

  try {
    await upsert(
      sql,
      'player_bio',
      [
        { name: 'player_id', type: 'text' },
        { name: 'nba_id', type: 'int' },
        { name: 'position', type: 'text' },
        { name: 'height', type: 'text' },
        { name: 'weight', type: 'int' },
        { name: 'jersey', type: 'text' },
        { name: 'age', type: 'int' },
      ],
      'player_id',
      merged('player_bio.json', 'player_id'),
    );
  } catch (e) {
    console.warn('skip player_bio (run migrate first to create 0005):', (e as Error).message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
