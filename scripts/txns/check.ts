// Pre-seed verification for the local data layer. Run before `npm run seed`.
//   npm run txns:check
// Hard-fails (exit 1) on duplicate override ids or malformed rows. Warns (exit 0) on override
// players that won't render (no 2026-27 salary) - usually a just-signed FA awaiting the scrape.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_AS_OF, RECENT_TRANSACTIONS } from '../../lib/data/freshness';

const root = process.cwd();
const SEASON = '2026-27';
const LAYERS = ['data/seed', 'scripts/scraper/out', 'data/overrides'];
function mergedRead<T>(file: string, key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const dir of LAYERS) {
    const p = path.join(root, dir, file);
    if (!fs.existsSync(p)) continue;
    for (const row of JSON.parse(fs.readFileSync(p, 'utf8')) as T[]) m.set(key(row), row);
  }
  return [...m.values()];
}

const errors: string[] = [];
const warnings: string[] = [];

const overrideRaw = JSON.parse(fs.readFileSync(path.join(root, 'data/overrides/players.json'), 'utf8')) as { id: string; name: string; team_id: string }[];
const seen = new Set<string>();
for (const r of overrideRaw) {
  if (!r.id || !r.name || !r.team_id) errors.push(`malformed override row: ${JSON.stringify(r)}`);
  if (seen.has(r.id)) errors.push(`duplicate override id: ${r.id}`);
  seen.add(r.id);
}

const contracts = mergedRead<{ player_id: string; season: string; salary: number }>('contracts.json', (c) => `${c.player_id}_${c.season}`);
const has2627 = new Set(contracts.filter((c) => c.season === SEASON && c.salary > 0).map((c) => c.player_id));
for (const r of overrideRaw) {
  if (!has2627.has(r.id)) warnings.push(`${r.name} (${r.id}) has no ${SEASON} salary - will NOT render on ${r.team_id.toUpperCase()} until the scrape adds a contract`);
}

const reflected = RECENT_TRANSACTIONS.filter((t) => t.reflected).length;
const pending = RECENT_TRANSACTIONS.length - reflected;

console.log(`txns:check  DATA_AS_OF=${DATA_AS_OF}`);
console.log(`  override players: ${overrideRaw.length}  |  transactions: ${RECENT_TRANSACTIONS.length} (${reflected} reflected, ${pending} pending)`);
if (warnings.length) console.log(`\nWARN (${warnings.length}):\n  ${warnings.join('\n  ')}`);
if (errors.length) { console.error(`\nFAIL (${errors.length}):\n  ${errors.join('\n  ')}`); process.exit(1); }
console.log(`\nOK - safe to seed.`);
