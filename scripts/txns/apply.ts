// Apply a batch of curated NBA transactions to the local data layer.
//   Input : scripts/txns/pending.json  (see scripts/txns/README.md for the schema)
//   Writes: data/overrides/players.json  (roster moves, keyed by player id)
//           lib/data/freshness.ts        (DATA_AS_OF + prepended RECENT_TRANSACTIONS)
// Run: npm run txns:apply
//
// Safety: a move only writes an override when the player already has a 2026-27 contract row
// (otherwise they can't render on a roster and moving them would misattribute the FA pool).
// Un-reflectable moves are reported, not written - author them as `reflect: false` and let the
// Basketball-Reference scrape pick up the new contract. Re-running is idempotent (dedupes by id
// for moves and by summary for the transaction feed).
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PENDING = path.join(root, 'scripts/txns/pending.json');
const OVERRIDE = path.join(root, 'data/overrides/players.json');
const FRESHNESS = path.join(root, 'lib/data/freshness.ts');
const SEASON = '2026-27';

const VALID = new Set(['atl','bos','bkn','cha','chi','cle','dal','den','det','gsw','hou','ind','lac','lal','mem','mia','mil','min','nop','nyk','okc','orl','phi','phx','por','sac','sas','tor','uta','was']);
const TEAM_FIX: Record<string, string> = { no: 'nop', ny: 'nyk', sa: 'sas', gs: 'gsw', phi: 'phi', pho: 'phx', brk: 'bkn', cho: 'cha', wsh: 'was', utah: 'uta', nola: 'nop' };

interface Move { player: string; team: string; reflect?: boolean }
interface Deal { date: string; status: 'final' | 'pending'; reflected?: boolean; summary: string; moves?: Move[] }
interface Batch { as_of: string; deals?: Deal[]; extensions?: Deal[] }

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
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const teamId = (t: string) => {
  const u = (t || '').toLowerCase().trim();
  return TEAM_FIX[u] ?? u;
};
// TS single-quoted string literal with escaping, so apostrophes in summaries never break the file.
const tsStr = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const batch: Batch = JSON.parse(fs.readFileSync(PENDING, 'utf8'));
if (!batch.as_of) throw new Error('pending.json needs an "as_of" date (YYYY-MM-DD)');

const players = mergedRead<{ id: string; name: string; team_id: string }>('players.json', (p) => p.id);
const contracts = mergedRead<{ player_id: string; season: string; salary: number }>('contracts.json', (c) => `${c.player_id}_${c.season}`);
const has2627 = new Set(contracts.filter((c) => c.season === SEASON && c.salary > 0).map((c) => c.player_id));
const byNorm = new Map(players.map((p) => [norm(p.name), p]));

interface OverrideRow { id: string; name: string; position: string | null; team_id: string; age: number | null; years_of_service: number | null; source?: string }
const overrideRows: OverrideRow[] = JSON.parse(fs.readFileSync(OVERRIDE, 'utf8'));
const overrideById = new Map(overrideRows.map((r) => [r.id, r]));

const applied: string[] = [];
const pendingMoves: string[] = [];
const missing: string[] = [];
const badTeam: string[] = [];

for (const deal of batch.deals ?? []) {
  for (const mv of deal.moves ?? []) {
    const tid = teamId(mv.team);
    if (!VALID.has(tid)) { badTeam.push(`${mv.player} -> "${mv.team}"`); continue; }
    const p = byNorm.get(norm(mv.player));
    if (!p) { missing.push(mv.player); continue; }
    if (mv.reflect === false) { pendingMoves.push(`${mv.player} -> ${tid.toUpperCase()} (authored reflect:false)`); continue; }
    if (!has2627.has(p.id)) { pendingMoves.push(`${mv.player} -> ${tid.toUpperCase()} (no ${SEASON} contract; needs scrape)`); continue; }
    const existing = overrideById.get(p.id);
    if (existing) { existing.team_id = tid; existing.source = 'override'; }
    else {
      const row: OverrideRow = { id: p.id, name: p.name, position: null, team_id: tid, age: null, years_of_service: null, source: 'override' };
      overrideRows.push(row);
      overrideById.set(p.id, row);
    }
    applied.push(`${mv.player} -> ${tid.toUpperCase()}`);
  }
}

// --- freshness.ts: bump DATA_AS_OF + prepend transaction feed (dedupe by summary) ---
let fresh = fs.readFileSync(FRESHNESS, 'utf8');
fresh = fresh.replace(/export const DATA_AS_OF = '[^']*';/, `export const DATA_AS_OF = '${batch.as_of}';`);

const feed: Deal[] = [...(batch.deals ?? []), ...(batch.extensions ?? [])];
const anchor = 'export const RECENT_TRANSACTIONS: Transaction[] = [';
const idx = fresh.indexOf(anchor);
if (idx === -1) throw new Error('could not find RECENT_TRANSACTIONS anchor in freshness.ts');
const insertAt = idx + anchor.length;

let addedTxns = 0;
const blocks: string[] = [];
for (const d of feed) {
  if (fresh.includes(tsStr(d.summary).slice(1, -1))) continue; // already present
  const reflected = d.reflected ?? false;
  blocks.push(
    `\n  {\n    date: '${d.date}',\n    status: '${d.status}',\n    reflected: ${reflected},\n    summary: ${tsStr(d.summary)},\n  },`,
  );
  addedTxns++;
}
if (blocks.length) fresh = fresh.slice(0, insertAt) + blocks.join('') + fresh.slice(insertAt);

fs.writeFileSync(OVERRIDE, JSON.stringify(overrideRows, null, 2) + '\n', 'utf8');
fs.writeFileSync(FRESHNESS, fresh, 'utf8');

// --- report ---
const line = (label: string, arr: string[]) => arr.length ? `\n${label} (${arr.length}):\n  ${arr.join('\n  ')}` : '';
console.log(`txns:apply  as_of=${batch.as_of}`);
console.log(`  players.json: ${overrideRows.length} override rows`);
console.log(`  freshness.ts: +${addedTxns} transaction(s)`);
console.log(line('APPLIED roster moves', applied));
console.log(line('PENDING (not written - no cap number / reflect:false)', pendingMoves));
if (missing.length) console.log(line('UNRESOLVED player names (fix spelling in pending.json)', missing));
if (badTeam.length) console.log(line('INVALID team ids', badTeam));
if (missing.length || badTeam.length) { console.error('\nErrors above - fix pending.json and re-run.'); process.exit(1); }
