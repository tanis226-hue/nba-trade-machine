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
  const params = cols.map((c) => rows.map((r) => r[c.name] ?? null));
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
      { name: 'source', type: 'text' },
    ],
    'id',
    merged('contracts.json', 'id'),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
