// Turn researched pick-ownership rows (scripts/picks/_raw.json: [{owner,original,year,round,protection,swap,frozen}])
// into data/seed/draft_picks.json matching the draft_picks schema. Run: npx tsx scripts/picks/build.ts
import fs from 'node:fs';
import path from 'node:path';

interface Raw {
  owner: string;
  original: string;
  year: number;
  round: 1 | 2;
  protection?: string | null;
  swap?: boolean;
  frozen?: boolean;
}

const root = process.cwd();
const raw: Raw[] = JSON.parse(fs.readFileSync(path.join(root, 'scripts/picks/_raw.json'), 'utf8'));

// Normalize researched abbreviations to our team ids (FK target).
const FIX: Record<string, string> = {
  NO: 'nop', NOLA: 'nop', NY: 'nyk', SA: 'sas', GS: 'gsw', UTAH: 'uta', WSH: 'was', PHO: 'phx', BRK: 'bkn', CHO: 'cha', SAN: 'sas',
};
const VALID = new Set(['atl','bos','bkn','cha','chi','cle','dal','den','det','gsw','hou','ind','lac','lal','mem','mia','mil','min','nop','nyk','okc','orl','phi','phx','por','sac','sas','tor','uta','was']);
const norm = (a: string) => {
  const u = (a || '').toUpperCase().trim();
  return FIX[u] ?? u.toLowerCase();
};

let dropped = 0;
const rows = raw
  .filter((p) => p.owner && p.original && p.year && (p.round === 1 || p.round === 2))
  .map((p, i) => {
    const owner = norm(p.owner);
    const original = norm(p.original);
    if (!VALID.has(owner) || !VALID.has(original)) {
      dropped++;
      return null;
    }
    return {
      id: `dp_${owner}_${p.year}_r${p.round}_${original}_${i}`,
      owning_team_id: owner,
      original_team_id: original,
      season: String(p.year),
      round: p.round,
      protections: p.protection ? { note: p.protection } : null,
      is_swap: !!p.swap,
      is_frozen: !!p.frozen,
      conveyed: false,
    };
  })
  .filter((r): r is NonNullable<typeof r> => r !== null);

if (dropped) console.log(`dropped ${dropped} picks with unresolvable team ids`);
fs.writeFileSync(path.join(root, 'data/seed/draft_picks.json'), JSON.stringify(rows, null, 2), 'utf8');

// Sanity: per-team first/second counts.
const counts: Record<string, { f: number; s: number }> = {};
for (const r of rows) {
  const c = (counts[r.owning_team_id] ??= { f: 0, s: 0 });
  if (r.round === 1) c.f++;
  else c.s++;
}
console.log(`wrote ${rows.length} draft picks to data/seed/draft_picks.json`);
console.log(
  Object.entries(counts)
    .sort()
    .map(([t, c]) => `${t.toUpperCase()}: ${c.f}F ${c.s}S`)
    .join('  '),
);
