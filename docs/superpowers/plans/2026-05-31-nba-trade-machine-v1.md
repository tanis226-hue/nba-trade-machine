# NBA Trade Machine v1 Implementation Plan (rev 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working NBA trade machine portal: assemble a 2–4 team trade with current rosters and full contracts, see accurate, current CBA luxury-tax/apron validation with descriptive errors, and save a shareable link — beating Fanspo/Spotrac on data currency, CBA correctness, and clean fast UI.

**Architecture:** Next.js (App Router) + TypeScript + Tailwind on Vercel; Supabase Postgres. A pure, dependency-free CBA engine (`lib/cba/`) runs client-side for instant feedback and is reused server-side for share pages. Data comes from a Python scraper normalized to JSON, overlaid with a hand-maintained override file, imported on a schedule. Trade state lives in Zustand; validation is memoized derived state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, Zustand, Supabase (supabase-js), Vitest, nanoid; Python 3 + httpx + selectolax for the scraper.

**Scope (v1 = Phases 0–4):** scaffold → data pipeline → CBA engine → data-rich trade UI (2–4 teams, season selector) → share links + multi-team OG image. Deferred (Phases 5–7, own plans): ad-network wiring + interstitial; trade-eligibility dates + future-date projection; cap holds/renouncing + TPE absorption + 5–6 teams + pick-protection UI.

**Verified CBA rules encoded (sources in spec §11):**
- 2025-26: cap $154,647,000 · tax $187,895,000 · apron1 $195,945,000 · apron2 $207,824,000.
- Below first apron matching: ≤$7.5M → 200%+$250K; $7.5M–$29M → outgoing+$7.5M; >$29M → 125%+$250K.
- Over first apron (incl. 2nd): 100% take-back. Second apron additionally: cannot aggregate salaries.

**Engine test principle:** matching/apron logic is tested with clean fixture numbers, so correctness is independent of real dollar figures. Real constants live in `constants.ts`, flagged VERIFY per season.

---

## File Structure

```
nba-trade-machine/
├── app/ (layout.tsx, page.tsx, trade/[slug]/page.tsx, trade/[slug]/opengraph-image.tsx, api/trade/route.ts)
├── components/ (TradeBoard, TradeMatrix, TeamColumn, TeamCapPanel, PlayerCard, AssetRow,
│               ValidationFeed, SeasonSelector, ExecuteTradeButton, GenerateLinkButton, AdSlot)
├── lib/
│   ├── cba/ (types, constants, tier, matching, apron, validateTrade, __tests__/)
│   ├── store/ (tradeStore, selectValidation, __tests__/)
│   └── data/ (supabase, types, queries)
├── data/overrides/ (contracts.override.json, etc. — authoritative corrections)
├── scripts/
│   ├── import.ts                merge scraped JSON + overrides -> upsert
│   └── scraper/ (fetch.py, parse.py, normalize.py, fixtures/, test_parse.py)
├── .github/workflows/refresh-data.yml   scheduled scrape+import
└── supabase/migrations/0001_init.sql
```

---

## Phase 0 — Scaffold

### Task 1: Initialize the Next.js app

- [ ] **Step 1: Scaffold into the current dir** (it already has `docs/` and `.git/`)

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```
If it refuses (non-empty dir), temporarily move `docs/` out, scaffold, move it back.

- [ ] **Step 2: Verify dev server**

Run: `npm run dev`, open http://localhost:3000, confirm default page, Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

### Task 2: Add Vitest, Zustand, deps

- [ ] **Step 1: Install**

```bash
npm install zustand @supabase/supabase-js nanoid
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom tsx
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"seed": "tsx scripts/import.ts"
```

- [ ] **Step 4: Smoke test `lib/cba/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Run + commit**

```bash
npm test   # 1 passed
git add -A && git commit -m "chore: add vitest, zustand, supabase deps and test setup"
```

---

## Phase 1 — Data pipeline

### Task 3: Schema migration

**Files:** Create `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration**

```sql
create table teams (
  id text primary key, name text not null, abbr text not null unique,
  conference text not null, logo_url text, primary_color text, secondary_color text
);

create table players (
  id text primary key, name text not null, position text,
  team_id text references teams(id), age int, years_of_service int
);

create table contracts (
  id text primary key, player_id text references players(id), season text not null,
  salary bigint not null,
  option_type text not null default 'guaranteed',     -- team|player|eto|guaranteed|non_guaranteed|two_way
  guarantee_status text not null default 'full',       -- full|partial|non_guaranteed
  partial_guarantee_amount bigint,
  no_trade_clause boolean not null default false,
  source text not null default 'scrape'                -- scrape|override
);
create index contracts_player_season_idx on contracts(player_id, season);

create table trade_restrictions (
  id text primary key, player_id text references players(id),
  kind text not null,                                  -- recently_signed|recently_extended|base_year_comp|poison_pill|sign_and_trade
  eligible_date date, cannot_aggregate_until date, note text
);

create table season_cap (
  season text primary key, salary_cap bigint not null, tax_line bigint not null,
  first_apron bigint not null, second_apron bigint not null, min_team_salary bigint not null
);

create table team_exceptions (
  id text primary key, team_id text references teams(id), season text not null,
  kind text not null, amount bigint not null, expires_date date  -- tpe|mle|bae|room
);

create table cap_holds (
  id text primary key, team_id text references teams(id), season text not null,
  label text not null, amount bigint not null, renounceable boolean not null default true
);

create table draft_picks (
  id text primary key, owning_team_id text references teams(id),
  original_team_id text references teams(id), season text not null, round int not null,
  protections jsonb, is_swap boolean not null default false, is_frozen boolean not null default false
);

create table trades (
  id text primary key, slug text not null unique, payload jsonb not null,
  created_at timestamptz not null default now()
);
create index trades_slug_idx on trades(slug);
```

- [ ] **Step 2: Apply** via Supabase MCP `apply_migration` (name `0001_init`) or `supabase db push`; verify with `list_tables` (10 tables).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql && git commit -m "feat: initial database schema with contract detail and apron data"
```

### Task 4: Override dataset + season cap seed

**Files:** Create `data/overrides/season_cap.json`, `data/overrides/teams.json`, `data/overrides/players.json`, `data/overrides/contracts.json`, `data/overrides/README.md`

- [ ] **Step 1: `data/overrides/season_cap.json`** (official 2025-26 — VERIFY each season)

```json
[
  { "season": "2025-26", "salary_cap": 154647000, "tax_line": 187895000, "first_apron": 195945000, "second_apron": 207824000, "min_team_salary": 139182000 }
]
```

- [ ] **Step 2: `data/overrides/teams.json`** (all 30 teams; first 4 shown — fill the rest)

```json
[
  { "id": "mia", "name": "Miami Heat", "abbr": "MIA", "conference": "East", "primary_color": "#98002E", "secondary_color": "#F9A01B" },
  { "id": "bos", "name": "Boston Celtics", "abbr": "BOS", "conference": "East", "primary_color": "#007A33", "secondary_color": "#BA9653" },
  { "id": "okc", "name": "Oklahoma City Thunder", "abbr": "OKC", "conference": "West", "primary_color": "#007AC1", "secondary_color": "#EF3B24" },
  { "id": "lal", "name": "Los Angeles Lakers", "abbr": "LAL", "conference": "West", "primary_color": "#552583", "secondary_color": "#FDB927" }
]
```

- [ ] **Step 3: `data/overrides/players.json` + `contracts.json`** (the authoritative correction layer — seed at least a couple teams so the app runs before the scraper lands; the Holmgren-style active-extension fix lives here)

```json
// players.json
[ { "id": "p_holmgren", "name": "Chet Holmgren", "position": "C", "team_id": "okc", "age": 24, "years_of_service": 3 } ]
```
```json
// contracts.json  (source must be "override" so it wins merges)
[
  { "id": "c_holmgren_2526", "player_id": "p_holmgren", "season": "2025-26", "salary": 13900000, "option_type": "team", "guarantee_status": "full", "no_trade_clause": false, "source": "override" },
  { "id": "c_holmgren_2627", "player_id": "p_holmgren", "season": "2026-27", "salary": 41200000, "option_type": "guaranteed", "guarantee_status": "full", "no_trade_clause": false, "source": "override" }
]
```

- [ ] **Step 4: `data/overrides/README.md`** documenting that override rows (`source:"override"`) always win over scraped rows in the merge, and how to add a correction.

- [ ] **Step 5: Commit**

```bash
git add data/overrides && git commit -m "feat: override dataset (authoritative corrections) + 2025-26 cap"
```

### Task 5: Python scraper (TDD the parser)

**Files:** Create `scripts/scraper/parse.py`, `scripts/scraper/fixtures/team_sample.html`, `scripts/scraper/test_parse.py`, `scripts/scraper/fetch.py`, `scripts/scraper/normalize.py`, `scripts/scraper/requirements.txt`

> Scraping is source-specific. TDD the parser against a saved HTML fixture so logic is verified offline; the live fetch is a thin, swappable layer. Confirm the chosen source's ToS (spec §11).

- [ ] **Step 1: `requirements.txt`**

```
httpx==0.27.*
selectolax==0.3.*
pytest==8.*
```

- [ ] **Step 2: Capture a real fixture** — save one team's salary page HTML from the chosen public source to `scripts/scraper/fixtures/team_sample.html` (used only for the test).

- [ ] **Step 3: Write the failing parser test `scripts/scraper/test_parse.py`** (assert against the players actually present in your captured fixture; example shape below)

```python
from pathlib import Path
from parse import parse_team

def test_parse_team_extracts_player_contracts():
    html = Path(__file__).parent.joinpath("fixtures/team_sample.html").read_text(encoding="utf-8")
    players = parse_team(html, team_id="okc")
    assert len(players) >= 1
    p = players[0]
    assert set(p.keys()) >= {"name", "team_id", "season", "salary", "option_type"}
    assert p["team_id"] == "okc"
    assert isinstance(p["salary"], int) and p["salary"] > 0
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd scripts/scraper && python -m pytest test_parse.py -v`
Expected: FAIL (no module `parse`).

- [ ] **Step 5: Implement `parse.py`** — fill the CSS selectors by inspecting your captured fixture; the structure is fixed:

```python
from selectolax.parser import HTMLParser

def parse_team(html: str, team_id: str) -> list[dict]:
    tree = HTMLParser(html)
    rows = tree.css("SELECTOR_FOR_EACH_PLAYER_ROW")  # inspect fixture, fill selector
    out: list[dict] = []
    for r in rows:
        name = r.css_first("SELECTOR_NAME").text(strip=True)            # fill
        salary_text = r.css_first("SELECTOR_CURRENT_SALARY").text()     # fill
        salary = int("".join(ch for ch in salary_text if ch.isdigit()) or "0")
        if salary == 0:
            continue
        out.append({
            "name": name, "team_id": team_id, "season": "2025-26",
            "salary": salary, "option_type": "guaranteed",
            "guarantee_status": "full", "no_trade_clause": False, "source": "scrape",
        })
    return out
```

- [ ] **Step 6: Run to verify it passes**

Run: `python -m pytest test_parse.py -v`
Expected: PASS.

- [ ] **Step 7: Implement `fetch.py` + `normalize.py`** — `fetch.py` downloads each team page (httpx, polite delay, real User-Agent); `normalize.py` writes `scripts/scraper/out/players.json` + `out/contracts.json` with stable ids (`slugify(name)`), assigning `player_id` consistently. Run `python normalize.py` once to produce the JSON.

```python
# normalize.py (essentials)
import json, re, pathlib
from fetch import fetch_team_html
from parse import parse_team

TEAMS = {"okc": "URL", "mia": "URL"}  # fill all 30 source URLs

def slug(s): return "p_" + re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def main():
    players, contracts = {}, []
    for team_id, url in TEAMS.items():
        for row in parse_team(fetch_team_html(url), team_id):
            pid = slug(row["name"])
            players[pid] = {"id": pid, "name": row["name"], "position": None, "team_id": team_id}
            contracts.append({"id": f"c_{pid}_{row['season']}", "player_id": pid, **{k: row[k] for k in ("season","salary","option_type","guarantee_status","no_trade_clause","source")}})
    out = pathlib.Path(__file__).parent / "out"; out.mkdir(exist_ok=True)
    (out / "players.json").write_text(json.dumps(list(players.values()), indent=2))
    (out / "contracts.json").write_text(json.dumps(contracts, indent=2))

if __name__ == "__main__": main()
```

- [ ] **Step 8: Commit**

```bash
git add scripts/scraper && git commit -m "feat: python scraper with TDD'd parser and normalizer"
```

### Task 6: Merge import (overrides win)

**Files:** Create `scripts/import.ts`, `lib/data/supabase.ts`

- [ ] **Step 1: `lib/data/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
export function createSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: `scripts/import.ts`** — load scraped `out/*` (if present) + overrides, merge so override rows replace scraped rows by `id`, upsert.

```ts
import fs from 'node:fs';
import path from 'node:path';
import { createSupabase } from '@/lib/data/supabase';

function read<T>(p: string): T[] { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) as T[] : []; }
function mergeById<T extends { id: string }>(base: T[], over: T[]): T[] {
  const m = new Map(base.map((r) => [r.id, r]));
  for (const r of over) m.set(r.id, r);
  return [...m.values()];
}
const root = process.cwd();
const scr = (f: string) => path.join(root, 'scripts/scraper/out', f);
const ovr = (f: string) => path.join(root, 'data/overrides', f);

async function main() {
  const db = createSupabase();
  const tables: [string, unknown[]][] = [
    ['season_cap', read(ovr('season_cap.json'))],
    ['teams', read(ovr('teams.json'))],
    ['players', mergeById(read(scr('players.json')), read(ovr('players.json')))],
    ['contracts', mergeById(read(scr('contracts.json')), read(ovr('contracts.json')))],
  ];
  for (const [t, rows] of tables) {
    if (!rows.length) { console.log(`skip ${t} (no rows)`); continue; }
    const { error } = await db.from(t).upsert(rows as never);
    if (error) throw new Error(`${t}: ${error.message}`);
    console.log(`upserted ${rows.length} into ${t}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add `.env.local`** with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (gitignored). Run `npm run seed`; expect "upserted N into ..." and idempotency on re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/import.ts lib/data/supabase.ts package.json && git commit -m "feat: merge import (scraper + overrides, overrides win)"
```

### Task 7: Scheduled refresh workflow

**Files:** Create `.github/workflows/refresh-data.yml`

- [ ] **Step 1: Write the workflow** (weekly + manual)

```yaml
name: refresh-data
on:
  schedule: [{ cron: "0 9 * * 1" }]
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r scripts/scraper/requirements.txt
      - run: cd scripts/scraper && python normalize.py
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run seed
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-data.yml && git commit -m "ci: scheduled weekly data refresh"
```

### Task 8: Season-aware queries

**Files:** Create `lib/data/types.ts`, `lib/data/queries.ts`

- [ ] **Step 1: `lib/data/types.ts`**

```ts
export interface DbTeam { id: string; name: string; abbr: string; conference: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; }
export interface DbSeasonCap { season: string; salary_cap: number; tax_line: number; first_apron: number; second_apron: number; min_team_salary: number; }
export interface ContractYear { season: string; salary: number; option_type: string; guarantee_status: string; no_trade_clause: boolean; }
export interface RosterEntry { playerId: string; name: string; position: string | null; age: number | null; salary: number; contract: ContractYear[]; }
```

- [ ] **Step 2: `lib/data/queries.ts`**

```ts
import { createSupabase } from './supabase';
import type { DbTeam, DbSeasonCap, RosterEntry } from './types';

export async function getSeasons(): Promise<string[]> {
  const { data, error } = await createSupabase().from('season_cap').select('season').order('season');
  if (error) throw error; return data.map((r) => r.season);
}
export async function getTeams(): Promise<DbTeam[]> {
  const { data, error } = await createSupabase().from('teams').select('*').order('name');
  if (error) throw error; return data;
}
export async function getSeasonCap(season: string): Promise<DbSeasonCap> {
  const { data, error } = await createSupabase().from('season_cap').select('*').eq('season', season).single();
  if (error) throw error; return data;
}
export async function getRoster(teamId: string, season: string): Promise<RosterEntry[]> {
  const { data, error } = await createSupabase()
    .from('players').select('id, name, position, age, contracts(season, salary, option_type, guarantee_status, no_trade_clause)')
    .eq('team_id', teamId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((p) => {
    const contract = (p.contracts ?? []).sort((a: any, b: any) => a.season.localeCompare(b.season));
    const cur = contract.find((c: any) => c.season === season);
    return { playerId: p.id, name: p.name, position: p.position, age: p.age, salary: cur?.salary ?? 0, contract };
  }).filter((r) => r.salary > 0);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/data/types.ts lib/data/queries.ts && git commit -m "feat: season-aware data queries with full contract detail"
```

---

## Phase 2 — CBA engine (TDD, verified rules)

### Task 9: Engine types

**Files:** Create `lib/cba/types.ts`

- [ ] **Step 1: Write `lib/cba/types.ts`**

```ts
export type ApronTier = 'below_cap' | 'over_cap' | 'over_tax' | 'first_apron' | 'second_apron';

export interface SeasonCap { season: string; salaryCap: number; taxLine: number; firstApron: number; secondApron: number; }

export interface MatchingBracket { upTo: number; pct: number; add: number; } // ordered ascending; last upTo = Infinity
export interface MatchingRules { belowApron: MatchingBracket[]; apronTakebackPct: number; }

export interface ApronTierRules { canAggregate: boolean; maxTakebackPct: number; blockedTools: string[]; }
export interface ApronRules { firstApron: ApronTierRules; secondApron: ApronTierRules; }

export interface TradeAsset { id: string; kind: 'player' | 'pick'; salary: number; fromTeam: string; toTeam: string; label: string; }
export interface TradeTeamInput { abbr: string; preTradeSalary: number; }
export interface TradeInput { season: SeasonCap; matching: MatchingRules; apron: ApronRules; teams: TradeTeamInput[]; assets: TradeAsset[]; }

export interface TeamResult { abbr: string; outgoing: number; incoming: number; postSalary: number; preTier: ApronTier; postTier: ApronTier; playersOut: number; }
export interface TradeError { code: string; teamAbbr: string; message: string; }
export interface TradeValidation { valid: boolean; perTeam: TeamResult[]; errors: TradeError[]; }
```

- [ ] **Step 2: Commit** — `git add lib/cba/types.ts && git commit -m "feat: cba engine types (bracketed matching, apron tiers)"`

### Task 10: tier.ts

**Files:** Create `lib/cba/tier.ts`, `lib/cba/__tests__/tier.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { tierFor } from '@/lib/cba/tier';
import type { SeasonCap } from '@/lib/cba/types';
const cap: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };
describe('tierFor', () => {
  it('below cap', () => expect(tierFor(90, cap)).toBe('below_cap'));
  it('over cap', () => expect(tierFor(120, cap)).toBe('over_cap'));
  it('over tax', () => expect(tierFor(145, cap)).toBe('over_tax'));
  it('first apron boundary', () => expect(tierFor(150, cap)).toBe('first_apron'));
  it('second apron boundary', () => expect(tierFor(160, cap)).toBe('second_apron'));
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run lib/cba/__tests__/tier.test.ts`

- [ ] **Step 3: Implement `lib/cba/tier.ts`**

```ts
import type { ApronTier, SeasonCap } from './types';
export function tierFor(salary: number, cap: SeasonCap): ApronTier {
  if (salary >= cap.secondApron) return 'second_apron';
  if (salary >= cap.firstApron) return 'first_apron';
  if (salary >= cap.taxLine) return 'over_tax';
  if (salary >= cap.salaryCap) return 'over_cap';
  return 'below_cap';
}
```

- [ ] **Step 4: Run → PASS (5)** — **Step 5: Commit** `git add lib/cba/tier.ts lib/cba/__tests__/tier.test.ts && git commit -m "feat: tierFor classifier with tests"`

### Task 11: matching.ts (3-tier + 100% apron)

**Files:** Create `lib/cba/matching.ts`, `lib/cba/__tests__/matching.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { maxIncomingSalary } from '@/lib/cba/matching';
import type { MatchingRules } from '@/lib/cba/types';
const rules: MatchingRules = {
  belowApron: [ { upTo: 10, pct: 2.0, add: 1 }, { upTo: 30, pct: 1.0, add: 8 }, { upTo: Infinity, pct: 1.25, add: 1 } ],
  apronTakebackPct: 1.0,
};
describe('maxIncomingSalary', () => {
  it('tier 1 (<=10): 200% + add', () => expect(maxIncomingSalary(5, 'over_cap', rules)).toBe(11));   // 5*2+1
  it('tier 2 (10-30): outgoing + add', () => expect(maxIncomingSalary(20, 'over_tax', rules)).toBe(28)); // 20*1+8
  it('tier 3 (>30): 125% + add', () => expect(maxIncomingSalary(40, 'over_cap', rules)).toBe(51));    // 40*1.25+1
  it('first apron: 100%', () => expect(maxIncomingSalary(20, 'first_apron', rules)).toBe(20));
  it('second apron: 100%', () => expect(maxIncomingSalary(20, 'second_apron', rules)).toBe(20));
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run lib/cba/__tests__/matching.test.ts`

- [ ] **Step 3: Implement `lib/cba/matching.ts`**

```ts
import type { ApronTier, MatchingRules } from './types';
export function maxIncomingSalary(outgoing: number, tier: ApronTier, rules: MatchingRules): number {
  if (tier === 'first_apron' || tier === 'second_apron') return outgoing * rules.apronTakebackPct;
  const b = rules.belowApron.find((br) => outgoing <= br.upTo) ?? rules.belowApron[rules.belowApron.length - 1];
  return outgoing * b.pct + b.add;
}
```

- [ ] **Step 4: Run → PASS (5)** — **Step 5: Commit** `git add lib/cba/matching.ts lib/cba/__tests__/matching.test.ts && git commit -m "feat: 3-tier salary matching with 100% apron cap"`

### Task 12: apron.ts

**Files:** Create `lib/cba/apron.ts`, `lib/cba/__tests__/apron.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { restrictionsFor } from '@/lib/cba/apron';
import type { ApronRules } from '@/lib/cba/types';
const rules: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.0, blockedTools: ['sign_and_trade', 'bae', 'non_taxpayer_mle', 'prior_year_tpe'] },
  secondApron: { canAggregate: false, maxTakebackPct: 1.0, blockedTools: ['mle', 'aggregation', 'cash_out', 'frozen_pick'] },
};
describe('restrictionsFor', () => {
  it('below apron: aggregate allowed, no blocked tools', () => expect(restrictionsFor('over_cap', rules)).toEqual({ canAggregate: true, maxTakebackPct: Infinity, blockedTools: [] }));
  it('first apron', () => expect(restrictionsFor('first_apron', rules)).toEqual(rules.firstApron));
  it('second apron: no aggregation', () => expect(restrictionsFor('second_apron', rules)).toEqual(rules.secondApron));
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run lib/cba/__tests__/apron.test.ts`

- [ ] **Step 3: Implement `lib/cba/apron.ts`**

```ts
import type { ApronTier, ApronRules, ApronTierRules } from './types';
export function restrictionsFor(tier: ApronTier, rules: ApronRules): ApronTierRules {
  if (tier === 'second_apron') return rules.secondApron;
  if (tier === 'first_apron') return rules.firstApron;
  return { canAggregate: true, maxTakebackPct: Infinity, blockedTools: [] };
}
```

- [ ] **Step 4: Run → PASS (3)** — **Step 5: Commit** `git add lib/cba/apron.ts lib/cba/__tests__/apron.test.ts && git commit -m "feat: apron restrictions resolver with tests"`

### Task 13: validateTrade.ts — happy path

**Files:** Create `lib/cba/validateTrade.ts`, `lib/cba/__tests__/fixtures.ts`, `lib/cba/__tests__/validateTrade.test.ts`

- [ ] **Step 1: `lib/cba/__tests__/fixtures.ts`**

```ts
import type { SeasonCap, MatchingRules, ApronRules } from '@/lib/cba/types';
export const season: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };
export const matching: MatchingRules = {
  belowApron: [ { upTo: 10, pct: 2.0, add: 1 }, { upTo: 30, pct: 1.0, add: 8 }, { upTo: Infinity, pct: 1.25, add: 1 } ],
  apronTakebackPct: 1.0,
};
export const apron: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.0, blockedTools: [] },
  secondApron: { canAggregate: false, maxTakebackPct: 1.0, blockedTools: [] },
};
```

- [ ] **Step 2: Failing test (legal even swap)**

```ts
import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/lib/cba/validateTrade';
import { season, matching, apron } from './fixtures';
import type { TradeInput } from '@/lib/cba/types';
const base = { season, matching, apron };
describe('validateTrade happy path', () => {
  it('legal even swap between two over-cap teams is valid', () => {
    const input: TradeInput = { ...base,
      teams: [ { abbr: 'AAA', preTradeSalary: 120 }, { abbr: 'BBB', preTradeSalary: 120 } ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'Player A' },
        { id: 'b1', kind: 'player', salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'Player B' },
      ] };
    const r = validateTrade(input);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    const aaa = r.perTeam.find((t) => t.abbr === 'AAA')!;
    expect(aaa.outgoing).toBe(20); expect(aaa.incoming).toBe(20); expect(aaa.postSalary).toBe(120);
  });
});
```

- [ ] **Step 3: Run → FAIL** — `npx vitest run lib/cba/__tests__/validateTrade.test.ts`

- [ ] **Step 4: Implement `lib/cba/validateTrade.ts`**

```ts
import type { TradeInput, TradeValidation, TeamResult, TradeError } from './types';
import { tierFor } from './tier';
import { maxIncomingSalary } from './matching';
import { restrictionsFor } from './apron';

export function validateTrade(input: TradeInput): TradeValidation {
  const { season, matching, apron, teams, assets } = input;
  const errors: TradeError[] = [];

  const perTeam: TeamResult[] = teams.map((team) => {
    const out = assets.filter((a) => a.fromTeam === team.abbr);
    const inc = assets.filter((a) => a.toTeam === team.abbr);
    const outgoing = out.reduce((s, a) => s + a.salary, 0);
    const incoming = inc.reduce((s, a) => s + a.salary, 0);
    const postSalary = team.preTradeSalary - outgoing + incoming;
    return { abbr: team.abbr, outgoing, incoming, postSalary,
      preTier: tierFor(team.preTradeSalary, season), postTier: tierFor(postSalary, season),
      playersOut: out.filter((a) => a.kind === 'player').length };
  });

  for (const t of perTeam) {
    if (t.outgoing === 0 && t.incoming === 0) continue;
    const restr = restrictionsFor(t.preTier, apron);
    if (t.playersOut >= 2 && !restr.canAggregate) {
      errors.push({ code: 'NO_AGGREGATION', teamAbbr: t.abbr, message: `${t.abbr} are above the second apron and cannot aggregate salaries in a trade.` });
    }
    if (t.outgoing > 0) {
      const limit = maxIncomingSalary(t.outgoing, t.preTier, matching);
      if (t.incoming > limit) {
        errors.push({ code: 'OVER_MATCH', teamAbbr: t.abbr, message: `${t.abbr} can take back at most ${fmt(limit)} for ${fmt(t.outgoing)} sent out, but are taking back ${fmt(t.incoming)}.` });
      }
    }
  }
  return { valid: errors.length === 0, perTeam, errors };
}

function fmt(n: number): string { return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n}`; }
```

- [ ] **Step 5: Run → PASS (1)** — **Step 6: Commit** `git add lib/cba/validateTrade.ts lib/cba/__tests__/fixtures.ts lib/cba/__tests__/validateTrade.test.ts && git commit -m "feat: validateTrade orchestrator (happy path)"`

### Task 14: validateTrade.ts — denial + no-phantom cases

**Files:** Modify `lib/cba/__tests__/validateTrade.test.ts`

- [ ] **Step 1: Add failing/period tests inside the describe block**

```ts
it('second-apron team sending 2 players => aggregation error', () => {
  const r = validateTrade({ season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 165 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'a2', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
      { id: 'b1', kind: 'player' as const, salary: 39, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ] });
  expect(r.errors.some((e) => e.code === 'NO_AGGREGATION' && e.teamAbbr === 'AAA')).toBe(true);
});
it('over-cap team taking back too much => match error', () => {
  // AAA sends 5 (tier1) => max incoming 5*2+1 = 11; takes back 40 => error
  const r = validateTrade({ season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 120 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 5, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'b1', kind: 'player' as const, salary: 40, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ] });
  expect(r.errors.some((e) => e.code === 'OVER_MATCH' && e.teamAbbr === 'AAA')).toBe(true);
});
it('first-apron team sending 2 players is allowed to aggregate (no phantom 2nd-apron block)', () => {
  const r = validateTrade({ season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 152 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 10, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'a2', kind: 'player' as const, salary: 5, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
      { id: 'b1', kind: 'player' as const, salary: 15, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ] });
  expect(r.errors.some((e) => e.code === 'NO_AGGREGATION')).toBe(false);
});
it('picks do not count toward aggregation or salary', () => {
  const r = validateTrade({ season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 165 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'pk', kind: 'pick' as const, salary: 0, fromTeam: 'AAA', toTeam: 'BBB', label: '2027 1st' },
      { id: 'b1', kind: 'player' as const, salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ] });
  expect(r.errors.some((e) => e.code === 'NO_AGGREGATION')).toBe(false);
});
```

- [ ] **Step 2: Run → all PASS** (implementation from Task 13 already handles these). `npx vitest run lib/cba/__tests__/validateTrade.test.ts`

- [ ] **Step 3: Commit** `git add lib/cba/__tests__/validateTrade.test.ts && git commit -m "test: apron aggregation, matching denial, no-phantom-block cases"`

### Task 15: Real constants

**Files:** Create `lib/cba/constants.ts`, `lib/cba/__tests__/constants.test.ts`

- [ ] **Step 1: `lib/cba/constants.ts`**

```ts
import type { SeasonCap, MatchingRules, ApronRules } from './types';

// 2025-26 official figures. Sources in spec §11. VERIFY each cap year before refresh.
export const SEASON_2025_26: SeasonCap = {
  season: '2025-26', salaryCap: 154_647_000, taxLine: 187_895_000,
  firstApron: 195_945_000, secondApron: 207_824_000,
};

// Below first apron: <=$7.5M -> 200%+$250K; $7.5M-$29M -> outgoing+$7.5M; >$29M -> 125%+$250K.
export const MATCHING_2025_26: MatchingRules = {
  belowApron: [
    { upTo: 7_500_000, pct: 2.0, add: 250_000 },
    { upTo: 29_000_000, pct: 1.0, add: 7_500_000 },
    { upTo: Infinity, pct: 1.25, add: 250_000 },
  ],
  apronTakebackPct: 1.0, // over first apron (incl. second): 100%
};

export const APRON_2025_26: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.0, blockedTools: ['sign_and_trade', 'bae', 'non_taxpayer_mle', 'prior_year_tpe'] },
  secondApron: { canAggregate: false, maxTakebackPct: 1.0, blockedTools: ['mle', 'aggregation', 'cash_out', 'sign_and_trade_tpe', 'frozen_pick'] },
};
```

- [ ] **Step 2: `lib/cba/__tests__/constants.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';
describe('constants', () => {
  it('cap landmarks strictly increasing', () => {
    const c = SEASON_2025_26;
    expect(c.salaryCap).toBeLessThan(c.taxLine);
    expect(c.taxLine).toBeLessThan(c.firstApron);
    expect(c.firstApron).toBeLessThan(c.secondApron);
  });
  it('matching brackets ordered, last is Infinity', () => {
    const b = MATCHING_2025_26.belowApron;
    expect(b[b.length - 1].upTo).toBe(Infinity);
  });
  it('second apron forbids aggregation', () => expect(APRON_2025_26.secondApron.canAggregate).toBe(false));
});
```

- [ ] **Step 3: Run full suite → PASS** — `npm test` — **Step 4: Commit** `git add lib/cba/constants.ts lib/cba/__tests__/constants.test.ts && git commit -m "feat: verified 2025-26 CBA constants"`

---

## Phase 3 — Trade UI (data-rich, clean)

> Run the **frontend-design** skill before Task 18 to establish the visual system (team-colored accents, cap meters, compact cards, clear hierarchy). Apply it as you build these components.

### Task 16: Trade store (season + team cap + assets)

**Files:** Create `lib/store/tradeStore.ts`, `lib/store/__tests__/tradeStore.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore } from '@/lib/store/tradeStore';
describe('tradeStore', () => {
  beforeEach(() => useTradeStore.getState().reset());
  it('adds teams, caps at 4, routes assets', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 }); s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' });
    s.routeAsset('a1', 'BBB');
    expect(useTradeStore.getState().assets['a1'].toTeam).toBe('BBB');
    ['C', 'D', 'E'].forEach((x) => s.addTeam({ abbr: x, preTradeSalary: 100 }));
    expect(useTradeStore.getState().teams.length).toBe(4);
  });
  it('setSeason updates season', () => {
    useTradeStore.getState().setSeason('2026-27');
    expect(useTradeStore.getState().season).toBe('2026-27');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run lib/store/__tests__/tradeStore.test.ts`

- [ ] **Step 3: Implement `lib/store/tradeStore.ts`**

```ts
import { create } from 'zustand';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
const MAX_TEAMS = 4;
interface TradeState {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  setSeason: (s: string) => void;
  addTeam: (t: TradeTeamInput) => void;
  removeTeam: (abbr: string) => void;
  addAsset: (a: TradeAsset) => void;
  routeAsset: (id: string, toTeam: string) => void;
  reset: () => void;
}
export const useTradeStore = create<TradeState>((set) => ({
  season: '2025-26', teams: [], assets: {},
  setSeason: (season) => set({ season }),
  addTeam: (t) => set((s) => (s.teams.length >= MAX_TEAMS || s.teams.some((x) => x.abbr === t.abbr)) ? s : { teams: [...s.teams, t] }),
  removeTeam: (abbr) => set((s) => ({ teams: s.teams.filter((t) => t.abbr !== abbr), assets: Object.fromEntries(Object.entries(s.assets).filter(([, a]) => a.fromTeam !== abbr && a.toTeam !== abbr)) })),
  addAsset: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  routeAsset: (id, toTeam) => set((s) => ({ assets: { ...s.assets, [id]: { ...s.assets[id], toTeam } } })),
  reset: () => set({ season: '2025-26', teams: [], assets: {} }),
}));
```

- [ ] **Step 4: Run → PASS (2)** — **Step 5: Commit** `git add lib/store/tradeStore.ts lib/store/__tests__/tradeStore.test.ts && git commit -m "feat: zustand trade store with season + 4-team cap"`

### Task 17: Validation selector (season-aware)

**Files:** Create `lib/store/selectValidation.ts`, `lib/store/__tests__/selectValidation.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { selectValidation } from '@/lib/store/selectValidation';
it('validates a legal swap built from store shape', () => {
  const r = selectValidation({ season: '2025-26',
    teams: [ { abbr: 'AAA', preTradeSalary: 120_000_000 }, { abbr: 'BBB', preTradeSalary: 120_000_000 } ],
    assets: {
      a1: { id: 'a1', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      b1: { id: 'b1', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    } });
  expect(r.valid).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run lib/store/__tests__/selectValidation.test.ts`

- [ ] **Step 3: Implement `lib/store/selectValidation.ts`** (maps season string → constants; extend the map as seasons are added)

```ts
import { validateTrade } from '@/lib/cba/validateTrade';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';
import type { TradeAsset, TradeTeamInput, TradeValidation } from '@/lib/cba/types';

const BY_SEASON = { '2025-26': { season: SEASON_2025_26, matching: MATCHING_2025_26, apron: APRON_2025_26 } } as const;

export function selectValidation(state: { season: string; teams: TradeTeamInput[]; assets: Record<string, TradeAsset> }): TradeValidation {
  const cfg = BY_SEASON[state.season as keyof typeof BY_SEASON] ?? BY_SEASON['2025-26'];
  return validateTrade({ ...cfg, teams: state.teams, assets: Object.values(state.assets) });
}
```

- [ ] **Step 4: Run → PASS (1)** — **Step 5: Commit** `git add lib/store/selectValidation.ts lib/store/__tests__/selectValidation.test.ts && git commit -m "feat: season-aware validation selector"`

### Task 18: AdSlot, PlayerCard, TeamCapPanel

**Files:** Create `components/AdSlot.tsx`, `components/PlayerCard.tsx`, `components/TeamCapPanel.tsx`

- [ ] **Step 1: `components/AdSlot.tsx`** (CLS-safe reserved box)

```tsx
const SIZES = { 'footer-mobile': { w: 320, h: 50 }, 'footer-desktop': { w: 728, h: 90 }, tower: { w: 300, h: 600 }, rectangle: { w: 300, h: 250 } } as const;
export function AdSlot({ size }: { size: keyof typeof SIZES }) {
  const { w, h } = SIZES[size];
  return <div aria-label="advertisement" style={{ minWidth: w, minHeight: h }} className="flex items-center justify-center bg-neutral-100 text-neutral-400 text-xs border border-dashed border-neutral-300">Ad {w}×{h}</div>;
}
```

- [ ] **Step 2: `components/PlayerCard.tsx`** (all the data a user needs: salary, full contract, option, NTC)

```tsx
'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const OPT: Record<string, string> = { team: 'TO', player: 'PO', eto: 'ETO', guaranteed: '', non_guaranteed: 'NG', two_way: '2W' };

export function PlayerCard({ asset, contract, teams }: { asset: TradeAsset; contract?: ContractYear[]; teams: TradeTeamInput[] }) {
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const dests = teams.filter((t) => t.abbr !== asset.fromTeam);
  return (
    <div className="rounded border p-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{asset.label}</span>
        <span className="tabular-nums">{m(asset.salary)}</span>
      </div>
      {contract && contract.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-500">
          {contract.map((c) => <span key={c.season} className="rounded bg-neutral-100 px-1">{c.season.slice(2)} {m(c.salary)}{OPT[c.option_type] ? ` ${OPT[c.option_type]}` : ''}{c.no_trade_clause ? ' · NTC' : ''}</span>)}
        </div>
      )}
      <select value={asset.toTeam} onChange={(e) => routeAsset(asset.id, e.target.value)} className="mt-1 w-full rounded border px-1 py-0.5 text-xs">
        <option value={asset.fromTeam}>Stay</option>
        {dests.map((t) => <option key={t.abbr} value={t.abbr}>→ {t.abbr}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: `components/TeamCapPanel.tsx`** (tier + distance-to-line meters)

```tsx
'use client';
import type { TeamResult } from '@/lib/cba/types';
import { SEASON_2025_26 } from '@/lib/cba/constants';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const TIER: Record<string, { label: string; cls: string }> = {
  below_cap: { label: 'Below cap', cls: 'bg-emerald-100 text-emerald-800' },
  over_cap: { label: 'Over cap', cls: 'bg-sky-100 text-sky-800' },
  over_tax: { label: 'Luxury tax', cls: 'bg-amber-100 text-amber-800' },
  first_apron: { label: '1st apron', cls: 'bg-orange-100 text-orange-800' },
  second_apron: { label: '2nd apron', cls: 'bg-red-100 text-red-800' },
};
export function TeamCapPanel({ result }: { result?: TeamResult }) {
  if (!result) return null;
  const cap = SEASON_2025_26;
  const pct = Math.min(100, (result.postSalary / cap.secondApron) * 100);
  const tier = TIER[result.postTier];
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tier.cls}`}>{tier.label}</span>
        <span className="text-xs tabular-nums">{m(result.postSalary)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded bg-neutral-200"><div className="h-full rounded bg-neutral-700" style={{ width: `${pct}%` }} /></div>
      <div className="mt-0.5 text-[10px] text-neutral-500">Tax {m(cap.taxLine)} · A1 {m(cap.firstApron)} · A2 {m(cap.secondApron)}</div>
    </div>
  );
}
```

- [ ] **Step 4: Commit** `git add components/AdSlot.tsx components/PlayerCard.tsx components/TeamCapPanel.tsx && git commit -m "feat: AdSlot, data-rich PlayerCard, TeamCapPanel with cap meters"`

### Task 19: TeamColumn, ValidationFeed, SeasonSelector

**Files:** Create `components/TeamColumn.tsx`, `components/ValidationFeed.tsx`, `components/SeasonSelector.tsx`

- [ ] **Step 1: `components/TeamColumn.tsx`**

```tsx
'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import { PlayerCard } from './PlayerCard';
import { TeamCapPanel } from './TeamCapPanel';
import type { TeamResult } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

export function TeamColumn({ abbr, result, contracts }: { abbr: string; result?: TeamResult; contracts: Record<string, ContractYear[]> }) {
  const assets = useTradeStore((s) => Object.values(s.assets));
  const teams = useTradeStore((s) => s.teams);
  const own = assets.filter((a) => a.fromTeam === abbr);
  const incoming = assets.filter((a) => a.toTeam === abbr && a.fromTeam !== abbr);
  return (
    <div className="flex-1 min-w-[260px] rounded border p-3">
      <div className="mb-1 font-bold">{abbr}</div>
      <TeamCapPanel result={result} />
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">Roster</div>
      <div className="space-y-1">{own.map((a) => <PlayerCard key={a.id} asset={a} contract={contracts[a.id]} teams={teams} />)}</div>
      {incoming.length > 0 && <div className="mt-2 text-[11px] uppercase tracking-wide text-emerald-600">Incoming</div>}
      <div className="space-y-1">{incoming.map((a) => <div key={a.id} className="rounded bg-emerald-50 px-2 py-1 text-sm">{a.label}</div>)}</div>
    </div>
  );
}
```

- [ ] **Step 2: `components/ValidationFeed.tsx`**

```tsx
'use client';
import type { TradeValidation } from '@/lib/cba/types';
export function ValidationFeed({ validation }: { validation: TradeValidation }) {
  if (validation.valid) return <div className="rounded bg-green-50 p-3 text-sm text-green-800">✓ Trade is legal under the CBA.</div>;
  return <div className="space-y-1 rounded bg-red-50 p-3 text-sm text-red-800">{validation.errors.map((e, i) => <div key={i}>Trade Denied: {e.message}</div>)}</div>;
}
```

- [ ] **Step 3: `components/SeasonSelector.tsx`**

```tsx
'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
export function SeasonSelector({ seasons }: { seasons: string[] }) {
  const season = useTradeStore((s) => s.season);
  const setSeason = useTradeStore((s) => s.setSeason);
  return (
    <label className="text-sm">Cap year:{' '}
      <select value={season} onChange={(e) => setSeason(e.target.value)} className="rounded border px-2 py-1">
        {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Commit** `git add components/TeamColumn.tsx components/ValidationFeed.tsx components/SeasonSelector.tsx && git commit -m "feat: team column, validation feed, season selector"`

### Task 20: TradeMatrix + TradeBoard + page wiring

**Files:** Create `components/TradeMatrix.tsx`, `components/ExecuteTradeButton.tsx`, `components/TradeBoard.tsx`; Modify `app/page.tsx`

- [ ] **Step 1: `components/ExecuteTradeButton.tsx`**

```tsx
'use client';
export function ExecuteTradeButton({ valid, onExecute }: { valid: boolean; onExecute: () => void }) {
  return <button onClick={onExecute} disabled={!valid} className={`w-full rounded py-3 font-bold text-white ${valid ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-neutral-400'}`}>Execute Trade</button>;
}
```

- [ ] **Step 2: `components/TradeMatrix.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { selectValidation } from '@/lib/store/selectValidation';
import { TeamColumn } from './TeamColumn';
import { ValidationFeed } from './ValidationFeed';
import { ExecuteTradeButton } from './ExecuteTradeButton';
import type { ContractYear } from '@/lib/data/types';

export function TradeMatrix({ contracts }: { contracts: Record<string, ContractYear[]> }) {
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const validation = useMemo(() => selectValidation({ season, teams, assets }), [season, teams, assets]);
  const byTeam = useMemo(() => Object.fromEntries(validation.perTeam.map((t) => [t.abbr, t])), [validation]);
  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto snap-x pb-2">
        {teams.map((t) => <div key={t.abbr} className="snap-start"><TeamColumn abbr={t.abbr} result={byTeam[t.abbr]} contracts={contracts} /></div>)}
      </div>
      <ValidationFeed validation={validation} />
      <ExecuteTradeButton valid={validation.valid && teams.length >= 2} onExecute={() => { /* Phase 5 interstitial */ }} />
    </div>
  );
}
```

- [ ] **Step 3: `components/TradeBoard.tsx`** (adds teams, seeds assets + per-asset contract map)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { TradeMatrix } from './TradeMatrix';
import { SeasonSelector } from './SeasonSelector';
import type { DbTeam } from '@/lib/data/types';
import type { RosterEntry } from '@/lib/data/types';
import type { ContractYear } from '@/lib/data/types';

export function TradeBoard({ teams, rosters, seasons }: { teams: DbTeam[]; rosters: Record<string, RosterEntry[]>; seasons: string[] }) {
  const storeTeams = useTradeStore((s) => s.teams);
  const addTeam = useTradeStore((s) => s.addTeam);
  const addAsset = useTradeStore((s) => s.addAsset);
  const [contracts, setContracts] = useState<Record<string, ContractYear[]>>({});

  function add(team: DbTeam) {
    const roster = rosters[team.abbr] ?? [];
    addTeam({ abbr: team.abbr, preTradeSalary: roster.reduce((s, r) => s + r.salary, 0) });
    const cmap: Record<string, ContractYear[]> = {};
    roster.forEach((r) => {
      const id = `${team.abbr}-${r.playerId}`;
      addAsset({ id, kind: 'player', salary: r.salary, fromTeam: team.abbr, toTeam: team.abbr, label: r.name });
      cmap[id] = r.contract;
    });
    setContracts((c) => ({ ...c, ...cmap }));
  }
  useEffect(() => () => useTradeStore.getState().reset(), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeasonSelector seasons={seasons} />
        <div className="flex flex-wrap gap-2">
          {teams.filter((t) => !storeTeams.some((s) => s.abbr === t.abbr)).map((t) => (
            <button key={t.id} onClick={() => add(t)} disabled={storeTeams.length >= 4} className="rounded border px-3 py-1 text-sm disabled:opacity-40">+ {t.abbr}</button>
          ))}
        </div>
      </div>
      {storeTeams.length >= 2 ? <TradeMatrix contracts={contracts} /> : <p className="text-neutral-500">Add at least two teams to start.</p>}
    </div>
  );
}
```

- [ ] **Step 4: `app/page.tsx`**

```tsx
import { getTeams, getRoster, getSeasons } from '@/lib/data/queries';
import { TradeBoard } from '@/components/TradeBoard';

export default async function Home() {
  const [teams, seasons] = await Promise.all([getTeams(), getSeasons()]);
  const season = seasons.includes('2025-26') ? '2025-26' : seasons[0];
  const rosters = Object.fromEntries(await Promise.all(teams.map(async (t) => [t.abbr, await getRoster(t.id, season)] as const)));
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-bold">NBA Trade Machine</h1>
      <TradeBoard teams={teams} rosters={rosters} seasons={seasons} />
    </main>
  );
}
```

- [ ] **Step 5: Verify in browser** — `npm run dev`; add 2–3 teams, route players, confirm live validation, descriptive denials, cap meters, contract detail on cards, season selector. No console errors, no layout shift.

- [ ] **Step 6: Commit** `git add components/TradeMatrix.tsx components/ExecuteTradeButton.tsx components/TradeBoard.tsx app/page.tsx && git commit -m "feat: data-rich multi-team trade matrix wired to live validation"`

### Task 21: Layout shell + responsive ads

**Files:** Modify `app/layout.tsx`

- [ ] **Step 1: Edit `app/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { AdSlot } from '@/components/AdSlot';
import './globals.css';
export const metadata = { title: 'NBA Trade Machine', description: 'Fast, accurate multi-team NBA trade simulator.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-[60px]">
        <div className="flex justify-center gap-4">
          <aside className="hidden xl:block"><AdSlot size="tower" /></aside>
          <div className="max-w-6xl flex-1">{children}</div>
          <aside className="hidden xl:block"><AdSlot size="tower" /></aside>
        </div>
        <footer className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t bg-white py-1">
          <div className="md:hidden"><AdSlot size="footer-mobile" /></div>
          <div className="hidden md:block"><AdSlot size="footer-desktop" /></div>
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify responsive** — towers hide < 1200px, columns scroll as a carousel on mobile, sticky footer swaps 728×90 ↔ 320×50, no CLS. **Step 3: Commit** `git add app/layout.tsx && git commit -m "feat: three-tier layout with sticky footer and tower ad slots"`

---

## Phase 4 — Sharing

### Task 22: Save/load trade API

**Files:** Create `app/api/trade/route.ts`; Modify `lib/data/queries.ts`

- [ ] **Step 1: Add to `lib/data/queries.ts`**

```ts
import { nanoid } from 'nanoid';
export interface TradePayload { season: string; teams: unknown; assets: unknown; contracts?: unknown; }
export async function saveTrade(payload: TradePayload): Promise<string> {
  const slug = nanoid(10);
  const { error } = await createSupabase().from('trades').insert({ id: slug, slug, payload });
  if (error) throw error; return slug;
}
export async function getTrade(slug: string): Promise<TradePayload | null> {
  const { data, error } = await createSupabase().from('trades').select('payload').eq('slug', slug).maybeSingle();
  if (error) throw error; return data ? (data.payload as TradePayload) : null;
}
```

- [ ] **Step 2: `app/api/trade/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { saveTrade } from '@/lib/data/queries';
export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = await saveTrade({ season: body.season, teams: body.teams, assets: body.assets, contracts: body.contracts });
  return NextResponse.json({ slug });
}
```

- [ ] **Step 3: Commit** `git add app/api/trade/route.ts lib/data/queries.ts && git commit -m "feat: persist and load shared trades"`

### Task 23: Generate-link button + share page

**Files:** Create `components/GenerateLinkButton.tsx`, `app/trade/[slug]/page.tsx`; Modify `components/TradeMatrix.tsx`

- [ ] **Step 1: `components/GenerateLinkButton.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
export function GenerateLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const season = useTradeStore((s) => s.season);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  async function gen() {
    const res = await fetch('/api/trade', { method: 'POST', body: JSON.stringify({ season, teams, assets }) });
    const { slug } = await res.json();
    setUrl(`${location.origin}/trade/${slug}`);
  }
  return (
    <div className="space-y-2">
      <button onClick={gen} className="rounded border px-4 py-2 font-medium">Generate Trade Link</button>
      {url && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border p-2 text-sm" />}
    </div>
  );
}
```

- [ ] **Step 2: Mount `<GenerateLinkButton />`** under `<ExecuteTradeButton />` in `components/TradeMatrix.tsx` (add import + render).

- [ ] **Step 3: `app/trade/[slug]/page.tsx`** (read-only, renders ALL teams — no truncation)

```tsx
import { getTrade } from '@/lib/data/queries';
import { selectValidation } from '@/lib/store/selectValidation';
import { ValidationFeed } from '@/components/ValidationFeed';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import { notFound } from 'next/navigation';

export default async function SharedTrade({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getTrade(slug);
  if (!payload) notFound();
  const teams = payload.teams as TradeTeamInput[];
  const assets = payload.assets as Record<string, TradeAsset>;
  const validation = selectValidation({ season: payload.season, teams, assets });
  const list = Object.values(assets);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Proposed Trade · {payload.season}</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((t) => (
          <div key={t.abbr} className="rounded border p-3">
            <div className="font-bold">{t.abbr}</div>
            {list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr).map((a) => <div key={a.id} className="text-sm">Receives: {a.label}</div>)}
          </div>
        ))}
      </div>
      <ValidationFeed validation={validation} />
    </main>
  );
}
```

- [ ] **Step 4: Verify end-to-end** — build a 3-team trade, Generate Trade Link, open the URL, confirm all 3 teams + assets + validation render. **Step 5: Commit** `git add app/trade components/GenerateLinkButton.tsx components/TradeMatrix.tsx && git commit -m "feat: generate trade links and read-only multi-team share page"`

### Task 24: Multi-team OG image (no truncation)

**Files:** Create `app/trade/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Implement with `next/og`** (sizes the layout to N teams)

```tsx
import { ImageResponse } from 'next/og';
import { getTrade } from '@/lib/data/queries';
import type { TradeTeamInput, TradeAsset } from '@/lib/cba/types';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const payload = await getTrade(params.slug);
  const teams = (payload?.teams as TradeTeamInput[] | undefined) ?? [];
  const assets = Object.values((payload?.assets as Record<string, TradeAsset> | undefined) ?? {});
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0b1020', color: 'white', padding: 48 }}>
        <div style={{ fontSize: 34, opacity: 0.7 }}>NBA Trade Machine</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 24, flex: 1 }}>
          {teams.map((t) => (
            <div key={t.abbr} style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #2a3350', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{t.abbr}</div>
              {assets.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr).slice(0, 6).map((a) => (
                <div key={a.id} style={{ fontSize: 22, marginTop: 6 }}>+ {a.label}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verify** — open `/trade/<slug>/opengraph-image`; confirm a 1200×630 PNG showing every team (3–4 columns) without cropping. **Step 3: Full suite + lint** `npm test && npm run lint`. **Step 4: Commit** `git add app/trade/[slug]/opengraph-image.tsx && git commit -m "feat: multi-team Open Graph image (no truncation)"`

---

## Follow-on plans (not in this plan)

- **Phase 5 — Monetization + polish:** real ad-network integration (AdSense/NitroPay, async/defer), 1.5s processing interstitial on Execute, share-page 300×250, mobile carousel + clean-UI refinement pass.
- **Phase 6 — Trade-eligibility dates + future-date projection:** consume `trade_restrictions`; a date picker that simulates a target date and surfaces "illegal now, legal on <date>" with the reason (recently-signed/extended, base-year comp, poison pill, 2-month aggregation, Dec-15/Jan-15 rules). Directly addresses Spotrac's "no future-date planning" gap.
- **Phase 7 — Cap room + depth:** below-cap absorption using cap space + cap-hold renouncing (Fanspo dump-trade gap), TPE absorption in matching, 5–6 teams, draft-pick protection editing UI, hard-cap trigger modeling when apron tools are used, Stepien-rule pick checks.

---

## Self-Review

**Spec coverage (spec §-by-§):**
- §2 decisions (stack, hybrid data, season-aware, v1 scope, design pass) → Tasks 1–2, 4–7 (hybrid pipeline), 16/19 (season), 18 design note. ✓
- §3 competitive requirements → currency (Tasks 4–7), exact apron application + no-phantom (Tasks 11–15, esp. Task 14 first-apron-can-aggregate test), multi-team share no-truncation (Tasks 23–24); cap-holds/future-date mapped to follow-on Phases 6–7 as the spec assigns. ✓
- §5 data model (10 tables, contract detail, restrictions, exceptions, holds) → Task 3. ✓
- §6 CBA engine (verified rules, 5 modules) → Tasks 9–15. ✓
- §7 frontend (SeasonSelector, PlayerCard, TeamCapPanel, TeamColumn, ValidationFeed, TradeMatrix, AdSlot, share) → Tasks 16–24. ✓
- §8 non-functional (client-side validation, CLS-safe ads, carousel) → Tasks 17/18/20/21. ✓
- §9 phasing → Phases 0–4 here; 5–7 listed follow-on. ✓
- §11 verification → Task 4/15 VERIFY flags + constants test. ✓

**Placeholder scan:** The only "fill" items are genuine data-entry / source-specific actions, each with a fully specified target shape and a test: Task 4 (remaining 26 teams + rosters — JSON shape given), Task 5 (CSS selectors — captured-fixture-driven TDD, structure fixed). No logic placeholders; every code step shows complete code. The "Phase 5 interstitial" comment is an intentional deferred hook, not missing logic.

**Type consistency:** `TradeAsset`, `TradeTeamInput`, `TradeInput`, `TradeValidation`, `TeamResult`, `ApronTier`, `SeasonCap`, `MatchingRules`/`MatchingBracket`, `ApronRules`/`ApronTierRules`, `ContractYear`, `RosterEntry`, `DbTeam`, `TradePayload` defined once and used identically downstream. Functions `tierFor`, `maxIncomingSalary`, `restrictionsFor`, `validateTrade`, `selectValidation`, `getTeams/getRoster/getSeasons/getSeasonCap`, `saveTrade/getTrade`, `useTradeStore` consistent across tasks. `selectValidation` signature `{ season, teams, assets }` matches its callers in Tasks 17/20/23. ✓
