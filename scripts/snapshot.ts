// Promote existing scraper output into the versioned demo seed. No fetches or DB writes.
// Curated overrides remain the final merge layer; this never advances DATA_AS_OF.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

interface Player { id: string }
interface Contract { id: string; player_id: string; salary: number }
const root = process.cwd();
const source = path.join(root, 'scripts', 'scraper', 'out');
const destination = path.join(root, 'data', 'seed');
const files = ['players.json', 'contracts.json'] as const;
const content = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(source, file), 'utf8')]));
const players = JSON.parse(content['players.json']) as Player[];
const contracts = JSON.parse(content['contracts.json']) as Contract[];

function checkIds(rows: { id: string }[], label: string) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((r) => typeof r.id !== 'string' || !r.id)
    || new Set(rows.map((r) => r.id)).size !== rows.length) {
    throw new Error(`${label}: expected nonempty rows with unique string IDs`);
  }
}
checkIds(players, 'players');
checkIds(contracts, 'contracts');
const playerIds = new Set(players.map((p) => p.id));
if (contracts.some((c) => !playerIds.has(c.player_id) || !Number.isFinite(c.salary) || c.salary < 0)) {
  throw new Error('contracts: invalid salary or missing player reference');
}

// Validate both inputs before replacing either seed file.
fs.mkdirSync(destination, { recursive: true });
const sources = files.map((file) => {
  fs.writeFileSync(path.join(destination, file), content[file], 'utf8');
  return {
    file: `scripts/scraper/out/${file}`,
    sha256: createHash('sha256').update(content[file]).digest('hex'),
    cacheFileModifiedAt: fs.statSync(path.join(source, file)).mtime.toISOString(),
  };
});
fs.writeFileSync(path.join(destination, 'snapshot.json'), JSON.stringify({
  note: 'Versioned demo baseline copied from the local scraper cache. File timestamps are not verified data freshness. Curated overrides apply after this baseline.',
  sources, players: players.length, contracts: contracts.length,
}, null, 2) + '\n');
console.log(`Versioned ${players.length} players and ${contracts.length} contracts. DATA_AS_OF unchanged; review freshness separately.`);
