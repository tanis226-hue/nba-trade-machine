import fs from 'node:fs';
import path from 'node:path';
import { createSupabase } from '@/lib/data/supabase';

const root = process.cwd();
const LAYERS = [
  path.join(root, 'data/seed'), // base
  path.join(root, 'scripts/scraper/out'), // scrape
  path.join(root, 'data/overrides'), // override (wins)
];

interface Row {
  id: string;
}

function read(dir: string, file: string): Row[] {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as Row[]) : [];
}

// Merge a table across all layers in order; later layers overwrite by id.
function merged(file: string): Row[] {
  const m = new Map<string, Row>();
  for (const dir of LAYERS) {
    for (const row of read(dir, file)) m.set(row.id, row);
  }
  return [...m.values()];
}

async function main() {
  const db = createSupabase();
  // Order matters for FK integrity: cap/teams -> players -> contracts.
  const tables = ['season_cap.json', 'teams.json', 'players.json', 'contracts.json'] as const;
  for (const file of tables) {
    const rows = merged(file);
    if (!rows.length) {
      console.log(`skip ${file} (no rows)`);
      continue;
    }
    const table = file.replace('.json', '');
    const { error } = await db.from(table).upsert(rows as never);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`upserted ${rows.length} into ${table}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
