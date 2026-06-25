// Pull 2025-26 per-game player box stats from the NBA stats endpoint and compute a transparent
// value metric (Hollinger Game Score, per game) for trade grading. Writes data/seed/player_value.json
// keyed to our p_<slug> player ids. Run from a residential IP: npx tsx scripts/stats/pull.ts
import fs from 'node:fs';
import path from 'node:path';

const STATS_SEASON = '2025-26'; // most recent completed season — the basis for player value
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Mirrors lib/slug.ts slugify(): fold diacritics to ASCII (Dončić -> doncic) BEFORE the alnum
// squash, so stats ids match the Basketball-Reference scrape instead of producing `luka_don_i`.
function slug(name: string): string {
  return (
    'p_' +
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

// 2026-27 first-round rookie scale, first-year salary at the customary 120% (projected; pick 1..30).
// These are formulaic rookie-scale figures, correctable via data/overrides once contracts are signed.
const ROOKIE_SCALE_2026: number[] = [
  13_800_000, 12_350_000, 11_100_000, 10_000_000, 9_050_000, 8_200_000, 7_450_000, 6_800_000, 6_200_000, 5_900_000,
  5_650_000, 5_400_000, 5_150_000, 4_900_000, 4_680_000, 4_480_000, 4_300_000, 4_150_000, 4_000_000, 3_870_000,
  3_750_000, 3_640_000, 3_540_000, 3_450_000, 3_370_000, 3_300_000, 3_240_000, 3_190_000, 3_150_000, 3_120_000,
];

// Merge new rows into a data/overrides/<file> JSON array by `id` (override rows win; never clobber existing).
function mergeOverride(dir: string, file: string, rows: Record<string, unknown>[]) {
  const p = path.join(dir, '..', 'overrides', file);
  let existing: Record<string, unknown>[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) || [];
  } catch {
    existing = [];
  }
  const ids = new Set(rows.map((r) => r.id));
  const merged = [...existing.filter((r) => !ids.has(r.id)), ...rows];
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf8');
  return merged.length;
}

// Hollinger Game Score: a transparent single-number per-game productivity metric.
function gameScore(g: Record<string, number>): number {
  return (
    g.PTS +
    0.4 * g.FGM -
    0.7 * g.FGA -
    0.4 * (g.FTA - g.FTM) +
    0.7 * g.OREB +
    0.3 * g.DREB +
    g.STL +
    0.7 * g.AST +
    0.7 * g.BLK -
    0.4 * g.PF -
    g.TOV
  );
}

async function main() {
  const params = new URLSearchParams({
    College: '', Conference: '', Country: '', DateFrom: '', DateTo: '', Division: '', DraftPick: '',
    DraftYear: '', GameScope: '', GameSegment: '', Height: '', LastNGames: '0', LeagueID: '00',
    Location: '', MeasureType: 'Base', Month: '0', OpponentTeamID: '0', Outcome: '', PORound: '0',
    PaceAdjust: 'N', PerMode: 'PerGame', Period: '0', PlayerExperience: '', PlayerPosition: '',
    PlusMinus: 'N', Rank: 'N', Season: STATS_SEASON, SeasonSegment: '', SeasonType: 'Regular Season',
    ShotClockRange: '', StarterBench: '', TeamID: '0', TwoWay: '0', VsConference: '', VsDivision: '', Weight: '',
  });
  const res = await fetch(`https://stats.nba.com/stats/leaguedashplayerstats?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`stats.nba.com ${res.status}`);
  const json = (await res.json()) as { resultSets: { headers: string[]; rowSet: unknown[][] }[] };
  const rs = json.resultSets[0];
  const idx = Object.fromEntries(rs.headers.map((h, i) => [h, i]));

  const out = rs.rowSet
    .map((row) => {
      const num = (k: string) => Number(row[idx[k]] ?? 0);
      const g = {
        PTS: num('PTS'), FGM: num('FGM'), FGA: num('FGA'), FTM: num('FTM'), FTA: num('FTA'),
        OREB: num('OREB'), DREB: num('DREB'), STL: num('STL'), AST: num('AST'), BLK: num('BLK'),
        PF: num('PF'), TOV: num('TOV'),
      };
      return {
        player_id: slug(String(row[idx['PLAYER_NAME']])),
        season: STATS_SEASON,
        gp: num('GP'),
        pts: round1(g.PTS),
        reb: round1(num('REB')),
        ast: round1(g.AST),
        value: round1(gameScore(g)),
      };
    })
    .filter((r) => r.gp >= 10); // ignore tiny-sample players

  const dir = path.join(process.cwd(), 'data/seed');
  fs.writeFileSync(path.join(dir, 'player_value.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`wrote ${out.length} player values (${STATS_SEASON} Game Score) to data/seed/player_value.json`);

  await pullBio(dir);
}

// Player bio (position, height, weight, jersey) from the current-season player index — fills null bio
// fields AND includes this year's rookies. (Player VALUE still comes from STATS_SEASON, the last completed year.)
const BIO_SEASON = '2026-27';

// Player age (most recent completed season) from the bio-stats endpoint, keyed by NBA person id.
// playerindex doesn't carry age, so we join this in. Best-effort: bio still writes if this fails.
async function pullAges(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const params = new URLSearchParams({
    LeagueID: '00', PerMode: 'PerGame', Season: STATS_SEASON, SeasonType: 'Regular Season',
    College: '', Conference: '', Country: '', DateFrom: '', DateTo: '', Division: '', DraftPick: '',
    DraftYear: '', GameScope: '', Height: '', LastNGames: '0', Location: '', Month: '0', OpponentTeamID: '0',
    PORound: '0', Period: '0', PlayerExperience: '', PlayerPosition: '', SeasonSegment: '', ShotClockRange: '',
    StarterBench: '', TeamID: '0', VsConference: '', VsDivision: '', Weight: '',
  });
  try {
    const res = await fetch(`https://stats.nba.com/stats/leaguedashplayerbiostats?${params}`, { headers: HEADERS });
    if (!res.ok) return map;
    const json = (await res.json()) as { resultSets: { headers: string[]; rowSet: unknown[][] }[] };
    const rs = json.resultSets[0];
    const idx = Object.fromEntries(rs.headers.map((h, i) => [h, i]));
    for (const row of rs.rowSet) {
      const id = Number(row[idx['PLAYER_ID']] ?? 0) || 0;
      const age = Number(row[idx['AGE']] ?? 0) || 0;
      if (id && age) map.set(id, age);
    }
  } catch {
    /* age join is best-effort */
  }
  return map;
}

async function pullBio(dir: string) {
  const res = await fetch(`https://stats.nba.com/stats/playerindex?Historical=0&LeagueID=00&Season=${BIO_SEASON}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`playerindex ${res.status}`);
  const json = (await res.json()) as { resultSets: { headers: string[]; rowSet: unknown[][] }[] };
  const rs = json.resultSets[0];
  const idx = Object.fromEntries(rs.headers.map((h, i) => [h, i]));

  const ageByNbaId = await pullAges(); // playerindex lacks age; bio-stats has it, keyed by person id

  const bio = rs.rowSet
    .map((row) => {
      const first = String(row[idx['PLAYER_FIRST_NAME']] ?? '').trim();
      const last = String(row[idx['PLAYER_LAST_NAME']] ?? '').trim();
      const pos = String(row[idx['POSITION']] ?? '').trim();
      const nbaId = Number(row[idx['PERSON_ID']] ?? 0) || null;
      return {
        player_id: slug(`${first} ${last}`),
        nba_id: nbaId,
        position: pos || null,
        height: String(row[idx['HEIGHT']] ?? '').trim() || null,
        weight: Number(row[idx['WEIGHT']] ?? 0) || null,
        jersey: String(row[idx['JERSEY_NUMBER']] ?? '').trim() || null,
        age: (nbaId && ageByNbaId.get(nbaId)) || null,
      };
    })
    .filter((b) => b.position);
  fs.writeFileSync(path.join(dir, 'player_bio.json'), JSON.stringify(bio, null, 2), 'utf8');
  console.log(`wrote ${bio.length} player bios to data/seed/player_bio.json`);

  // Years of service from the player index's FROM_YEAR (first NBA season). Drives RFA detection and
  // min-scale / over-38 eligibility. Written as its own file so the importer can UPDATE only this
  // column (no full-row override, so a player's team/position stay sourced from the live scrape).
  const seasonStart = Number(BIO_SEASON.slice(0, 4));
  const hasFromYear = 'FROM_YEAR' in idx;
  const yos = rs.rowSet
    .map((row) => {
      const first = String(row[idx['PLAYER_FIRST_NAME']] ?? '').trim();
      const last = String(row[idx['PLAYER_LAST_NAME']] ?? '').trim();
      const fromYear = hasFromYear ? Number(row[idx['FROM_YEAR']] ?? 0) : 0;
      return { player_id: slug(`${first} ${last}`), years_of_service: fromYear ? Math.max(0, seasonStart - fromYear) : 0 };
    })
    .filter((r) => r.player_id !== 'p_');
  fs.writeFileSync(path.join(dir, 'player_yos.json'), JSON.stringify(yos, null, 2), 'utf8');
  console.log(`wrote ${yos.length} years-of-service rows to data/seed/player_yos.json${hasFromYear ? '' : ' (WARN: FROM_YEAR missing from playerindex; all 0)'}`);

  // 2026 draft class: the player index lists this year's rookies with team + pick. Inject them as
  // players + rookie-scale contracts via the override layer so they show on rosters (with headshots).
  const players: Record<string, unknown>[] = [];
  const contracts: Record<string, unknown>[] = [];
  for (const row of rs.rowSet) {
    if (String(row[idx['DRAFT_YEAR']]) !== '2026' || Number(row[idx['DRAFT_ROUND']]) !== 1) continue;
    const name = `${String(row[idx['PLAYER_FIRST_NAME']] ?? '').trim()} ${String(row[idx['PLAYER_LAST_NAME']] ?? '').trim()}`.trim();
    const team = String(row[idx['TEAM_ABBREVIATION']] ?? '').toLowerCase();
    const pick = Number(row[idx['DRAFT_NUMBER']] ?? 0);
    if (!name || !team || !pick) continue;
    const pid = slug(name);
    players.push({ id: pid, name, position: String(row[idx['POSITION']] ?? '') || null, team_id: team, age: null, years_of_service: 0 });
    contracts.push({
      id: `c_${pid.slice(2)}_2026-27`,
      player_id: pid,
      season: '2026-27',
      salary: ROOKIE_SCALE_2026[pick - 1] ?? 3_000_000,
      option_type: 'guaranteed',
      guarantee_status: 'full',
      no_trade_clause: false,
      source: 'override',
    });
  }
  if (players.length) {
    mergeOverride(dir, 'players.json', players);
    mergeOverride(dir, 'contracts.json', contracts);
    console.log(`injected ${players.length} 2026 first-round rookies into data/overrides (players.json + contracts.json)`);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
