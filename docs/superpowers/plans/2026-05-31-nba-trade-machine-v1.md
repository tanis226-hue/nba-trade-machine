# NBA Trade Machine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working NBA trade machine portal where a user can assemble a 2–4 team trade, move players and draft picks between teams, and see live luxury-tax / apron validation with descriptive errors, then save a shareable link.

**Architecture:** Next.js (App Router) + TypeScript + Tailwind on Vercel, Supabase Postgres for data. The CBA validation engine is a pure, dependency-free TypeScript module (`lib/cba/`) that runs client-side for instant feedback and is reused server-side for the share page. Trade state lives in a Zustand store; validation is memoized derived state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand, Supabase (postgres-js / supabase-js), Vitest (engine + unit tests), Playwright optional later.

**Scope:** Phases 0–4 (v1). Picks are movable assets but the protection-editing UI, ad-network wiring, live scraper, and 5–6 teams are out of scope (follow-on plans).

**Engine design principle:** `matching.ts` and `apron.ts` take their rule tables as arguments so logic correctness is tested with clean fixture numbers (cap = $100M, etc.), independent of real-league dollar figures. Real 2025-26 constants live in `constants.ts`, flagged for verification, and only affect data, not logic.

---

## File Structure

```
nba-trade-machine/
├── package.json, tsconfig.json, next.config.ts, tailwind.config.ts, vitest.config.ts
├── .env.local                      Supabase URL + anon key (gitignored)
├── app/
│   ├── layout.tsx                  root layout, Tailwind, AdSlot shells
│   ├── page.tsx                    the trade machine
│   ├── trade/[slug]/page.tsx       read-only shared trade
│   └── api/trade/route.ts          POST save trade -> slug, GET load
├── components/
│   ├── TradeMatrix.tsx             columns container, AddTeamButton
│   ├── TeamColumn.tsx              one team: roster + incoming + cap badges
│   ├── AssetRow.tsx                player/pick row with destination control
│   ├── ValidationFeed.tsx         per-team deltas + descriptive errors
│   ├── ExecuteTradeButton.tsx     runs validation, shows result
│   └── AdSlot.tsx                  reserved min-height ad placeholder (CLS-safe)
├── lib/
│   ├── cba/
│   │   ├── types.ts               shared engine types
│   │   ├── constants.ts           2025-26 season cap + rule tables (VERIFY)
│   │   ├── tier.ts                tierFor(salary, season) -> ApronTier
│   │   ├── matching.ts            maxIncomingSalary(outgoing, tier, rules)
│   │   ├── apron.ts               restrictionsFor(tier, rules)
│   │   └── validateTrade.ts       orchestrator -> TradeValidation
│   ├── store/tradeStore.ts        Zustand store + selectTradeInput
│   └── data/
│       ├── supabase.ts            client factory
│       ├── types.ts               DB row types
│       └── queries.ts            getTeams, getRoster, saveTrade, getTrade
├── data/
│   └── seed/                       teams.json, players.json, contracts.json,
│                                   picks.json, season_cap.json
├── scripts/
│   └── import-seed.ts             idempotent upsert of seed JSON
└── supabase/migrations/
    └── 0001_init.sql              schema
```

---

## Phase 0 — Scaffold

### Task 1: Initialize the Next.js app

**Files:**
- Create: project files via `create-next-app`

- [ ] **Step 1: Scaffold the app into the current directory**

Run (the directory already contains `docs/` and `.git/`; answer the prompts as below):
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```
Expected: project files created. If it refuses due to non-empty dir, move `docs/` aside, scaffold, then move it back.

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then open http://localhost:3000
Expected: default Next.js page renders. Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

### Task 2: Add Vitest and Zustand

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install deps**

Run:
```bash
npm install zustand @supabase/supabase-js nanoid
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
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

- [ ] **Step 3: Add test scripts to `package.json`**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test `lib/cba/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add vitest, zustand, supabase deps and test setup"
```

---

## Phase 1 — Data layer

### Task 3: Schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration**

```sql
create table teams (
  id text primary key,
  name text not null,
  abbr text not null unique,
  conference text not null,
  logo_url text,
  primary_color text,
  secondary_color text
);

create table players (
  id text primary key,
  name text not null,
  position text,
  team_id text references teams(id)
);

create table contracts (
  id text primary key,
  player_id text references players(id),
  season text not null,
  salary bigint not null,
  option_type text not null default 'guaranteed'
);

create table season_cap (
  season text primary key,
  salary_cap bigint not null,
  tax_line bigint not null,
  first_apron bigint not null,
  second_apron bigint not null
);

create table draft_picks (
  id text primary key,
  owning_team_id text references teams(id),
  original_team_id text references teams(id),
  season text not null,
  round int not null,
  protections jsonb,
  is_swap boolean not null default false
);

create table trades (
  id text primary key,
  slug text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index trades_slug_idx on trades(slug);
```

- [ ] **Step 2: Apply it**

Apply via the Supabase MCP `apply_migration` tool (name `0001_init`) or `supabase db push` if the CLI is linked. Verify with `list_tables`.
Expected: 6 tables present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: initial database schema"
```

### Task 4: Seed dataset

**Files:**
- Create: `data/seed/season_cap.json`, `teams.json`, `players.json`, `contracts.json`, `picks.json`

- [ ] **Step 1: Create `data/seed/season_cap.json`**

> VERIFY these 2025-26 figures against an authoritative cap source before ship. Logic does not depend on them.
```json
[
  { "season": "2025-26", "salary_cap": 154600000, "tax_line": 187900000, "first_apron": 195900000, "second_apron": 207800000 }
]
```

- [ ] **Step 2: Create `data/seed/teams.json` (start with 6 teams for a usable demo)**

```json
[
  { "id": "mia", "name": "Miami Heat", "abbr": "MIA", "conference": "East", "primary_color": "#98002E", "secondary_color": "#F9A01B" },
  { "id": "bos", "name": "Boston Celtics", "abbr": "BOS", "conference": "East", "primary_color": "#007A33", "secondary_color": "#BA9653" },
  { "id": "lal", "name": "Los Angeles Lakers", "abbr": "LAL", "conference": "West", "primary_color": "#552583", "secondary_color": "#FDB927" },
  { "id": "gsw", "name": "Golden State Warriors", "abbr": "GSW", "conference": "West", "primary_color": "#1D428A", "secondary_color": "#FFC72C" },
  { "id": "nyk", "name": "New York Knicks", "abbr": "NYK", "conference": "East", "primary_color": "#006BB6", "secondary_color": "#F58426" },
  { "id": "okc", "name": "Oklahoma City Thunder", "abbr": "OKC", "conference": "West", "primary_color": "#007AC1", "secondary_color": "#EF3B24" }
]
```

- [ ] **Step 3: Create `data/seed/players.json` and `contracts.json`**

Provide at least 8 players per team with one 2025-26 contract row each. Example shape (fill realistic rosters — VERIFY salaries):
```json
// players.json
[ { "id": "p_butler", "name": "Jimmy Butler", "position": "F", "team_id": "mia" } ]
```
```json
// contracts.json
[ { "id": "c_butler_2526", "player_id": "p_butler", "season": "2025-26", "salary": 48798677, "option_type": "guaranteed" } ]
```

- [ ] **Step 4: Create `data/seed/picks.json` (a few first-round picks per team)**

```json
[ { "id": "pick_mia_2026_1", "owning_team_id": "mia", "original_team_id": "mia", "season": "2026", "round": 1, "is_swap": false } ]
```

- [ ] **Step 5: Commit**

```bash
git add data/seed
git commit -m "feat: seed dataset for teams, players, contracts, picks, cap"
```

### Task 5: Supabase client + DB types

**Files:**
- Create: `lib/data/supabase.ts`, `lib/data/types.ts`

- [ ] **Step 1: Create `lib/data/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

export function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Create `lib/data/types.ts`**

```ts
export interface DbTeam { id: string; name: string; abbr: string; conference: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; }
export interface DbPlayer { id: string; name: string; position: string | null; team_id: string; }
export interface DbContract { id: string; player_id: string; season: string; salary: number; option_type: string; }
export interface DbSeasonCap { season: string; salary_cap: number; tax_line: number; first_apron: number; second_apron: number; }
export interface DbDraftPick { id: string; owning_team_id: string; original_team_id: string; season: string; round: number; protections: unknown; is_swap: boolean; }
```

- [ ] **Step 3: Add `.env.local` (gitignored) with Supabase URL + anon key**

Get values from Supabase project settings. Confirm `.env.local` is in `.gitignore` (create-next-app adds it).

- [ ] **Step 4: Commit**

```bash
git add lib/data/supabase.ts lib/data/types.ts
git commit -m "feat: supabase client and db row types"
```

### Task 6: Seed import script

**Files:**
- Create: `scripts/import-seed.ts`
- Modify: `package.json` (add `"seed"` script)

- [ ] **Step 1: Write `scripts/import-seed.ts`**

```ts
import { createSupabase } from '@/lib/data/supabase';
import teams from '@/data/seed/teams.json';
import players from '@/data/seed/players.json';
import contracts from '@/data/seed/contracts.json';
import picks from '@/data/seed/picks.json';
import seasonCap from '@/data/seed/season_cap.json';

async function main() {
  const db = createSupabase();
  for (const [table, rows] of [
    ['season_cap', seasonCap], ['teams', teams], ['players', players],
    ['contracts', contracts], ['draft_picks', picks],
  ] as const) {
    const { error } = await db.from(table).upsert(rows as never);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`upserted ${rows.length} into ${table}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add script + tsx**

Run: `npm install -D tsx`
Add to `package.json` scripts: `"seed": "tsx scripts/import-seed.ts"`

- [ ] **Step 3: Run the import**

Run: `npm run seed`
Expected: "upserted N into ..." for each table, no errors. Re-run once to confirm idempotency (same output, no duplicate-key errors).

- [ ] **Step 4: Commit**

```bash
git add scripts/import-seed.ts package.json package-lock.json
git commit -m "feat: idempotent seed import script"
```

### Task 7: Data queries

**Files:**
- Create: `lib/data/queries.ts`

- [ ] **Step 1: Write `lib/data/queries.ts`**

```ts
import { createSupabase } from './supabase';
import type { DbTeam, DbSeasonCap } from './types';

export interface RosterEntry { playerId: string; name: string; position: string | null; salary: number; }

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
  const db = createSupabase();
  const { data, error } = await db
    .from('players')
    .select('id, name, position, contracts!inner(salary, season)')
    .eq('team_id', teamId)
    .eq('contracts.season', season);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((p) => ({ playerId: p.id, name: p.name, position: p.position, salary: p.contracts[0].salary }));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/data/queries.ts
git commit -m "feat: data access queries for teams, roster, season cap"
```

---

## Phase 2 — CBA engine (TDD)

### Task 8: Engine types

**Files:**
- Create: `lib/cba/types.ts`

- [ ] **Step 1: Write `lib/cba/types.ts`**

```ts
export type ApronTier =
  | 'below_cap'    // team salary < salary cap
  | 'over_cap'     // >= cap, < tax line
  | 'over_tax'     // >= tax line, < first apron
  | 'first_apron'  // >= first apron, < second apron
  | 'second_apron';// >= second apron

export interface SeasonCap {
  season: string;
  salaryCap: number;
  taxLine: number;
  firstApron: number;
  secondApron: number;
}

export interface MatchingRules {
  belowApronPct: number; // multiplier on outgoing for teams below first apron, e.g. 2.0
  belowApronAdd: number; // flat add, e.g. 250_000
  apronTakebackPct: number; // multiplier for teams at/above first apron, e.g. 1.10
}

export interface ApronRules {
  firstApron: { canAggregate: boolean; maxTakebackPct: number };
  secondApron: { canAggregate: boolean; maxTakebackPct: number };
}

export interface TradeAsset {
  id: string;
  kind: 'player' | 'pick';
  salary: number;     // 0 for picks
  fromTeam: string;   // team abbr
  toTeam: string;     // team abbr
  label: string;
}

export interface TradeTeamInput { abbr: string; preTradeSalary: number; }

export interface TradeInput {
  season: SeasonCap;
  matching: MatchingRules;
  apron: ApronRules;
  teams: TradeTeamInput[];
  assets: TradeAsset[];
}

export interface TeamResult {
  abbr: string;
  outgoing: number;
  incoming: number;
  postSalary: number;
  preTier: ApronTier;
  postTier: ApronTier;
  playersOut: number;
}

export interface TradeError { code: string; teamAbbr: string; message: string; }

export interface TradeValidation { valid: boolean; perTeam: TeamResult[]; errors: TradeError[]; }
```

- [ ] **Step 2: Commit**

```bash
git add lib/cba/types.ts
git commit -m "feat: cba engine types"
```

### Task 9: tier.ts

**Files:**
- Create: `lib/cba/tier.ts`, `lib/cba/__tests__/tier.test.ts`

- [ ] **Step 1: Write the failing test `lib/cba/__tests__/tier.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tierFor } from '@/lib/cba/tier';
import type { SeasonCap } from '@/lib/cba/types';

const cap: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };

describe('tierFor', () => {
  it('below cap', () => { expect(tierFor(90, cap)).toBe('below_cap'); });
  it('over cap', () => { expect(tierFor(120, cap)).toBe('over_cap'); });
  it('over tax', () => { expect(tierFor(145, cap)).toBe('over_tax'); });
  it('first apron at boundary', () => { expect(tierFor(150, cap)).toBe('first_apron'); });
  it('second apron at boundary', () => { expect(tierFor(160, cap)).toBe('second_apron'); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/cba/__tests__/tier.test.ts`
Expected: FAIL ("tierFor is not a function" / module not found).

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

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/cba/__tests__/tier.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/cba/tier.ts lib/cba/__tests__/tier.test.ts
git commit -m "feat: tierFor cap-tier classifier with tests"
```

### Task 10: matching.ts

**Files:**
- Create: `lib/cba/matching.ts`, `lib/cba/__tests__/matching.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { maxIncomingSalary } from '@/lib/cba/matching';
import type { MatchingRules } from '@/lib/cba/types';

const rules: MatchingRules = { belowApronPct: 2.0, belowApronAdd: 250, apronTakebackPct: 1.10 };

describe('maxIncomingSalary', () => {
  it('below first apron uses pct + add', () => {
    expect(maxIncomingSalary(100, 'over_cap', rules)).toBe(250); // 100*2 + 50? -> 100*2.0 + 250 = 450
  });
});
```

> Note: the expected value above is intentionally wrong to force a fail; correct it in Step 3's test alongside implementation. The real assertion: `maxIncomingSalary(100, 'over_cap', rules)` = `100*2.0 + 250 = 450`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/cba/__tests__/matching.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/cba/matching.ts` and fix the test assertions**

`lib/cba/matching.ts`:
```ts
import type { ApronTier, MatchingRules } from './types';

export function maxIncomingSalary(outgoing: number, tier: ApronTier, rules: MatchingRules): number {
  if (tier === 'first_apron' || tier === 'second_apron') {
    return outgoing * rules.apronTakebackPct;
  }
  return outgoing * rules.belowApronPct + rules.belowApronAdd;
}
```

Replace the test body with correct assertions:
```ts
describe('maxIncomingSalary', () => {
  it('below first apron uses pct + add', () => {
    expect(maxIncomingSalary(100, 'over_cap', rules)).toBe(450);
  });
  it('over tax (still below apron) uses pct + add', () => {
    expect(maxIncomingSalary(100, 'over_tax', rules)).toBe(450);
  });
  it('first apron uses tighter takeback pct', () => {
    expect(maxIncomingSalary(100, 'first_apron', rules)).toBeCloseTo(110);
  });
  it('second apron uses tighter takeback pct', () => {
    expect(maxIncomingSalary(100, 'second_apron', rules)).toBeCloseTo(110);
  });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/cba/__tests__/matching.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/cba/matching.ts lib/cba/__tests__/matching.test.ts
git commit -m "feat: salary-matching limit with tests"
```

### Task 11: apron.ts

**Files:**
- Create: `lib/cba/apron.ts`, `lib/cba/__tests__/apron.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { restrictionsFor } from '@/lib/cba/apron';
import type { ApronRules } from '@/lib/cba/types';

const rules: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.25 },
  secondApron: { canAggregate: false, maxTakebackPct: 1.10 },
};

describe('restrictionsFor', () => {
  it('below apron: aggregation allowed, generous takeback', () => {
    expect(restrictionsFor('over_cap', rules)).toEqual({ canAggregate: true, maxTakebackPct: Infinity });
  });
  it('first apron: aggregation allowed, capped takeback', () => {
    expect(restrictionsFor('first_apron', rules)).toEqual({ canAggregate: true, maxTakebackPct: 1.25 });
  });
  it('second apron: no aggregation', () => {
    expect(restrictionsFor('second_apron', rules)).toEqual({ canAggregate: false, maxTakebackPct: 1.10 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/cba/__tests__/apron.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/cba/apron.ts`**

```ts
import type { ApronTier, ApronRules } from './types';

export interface Restrictions { canAggregate: boolean; maxTakebackPct: number; }

export function restrictionsFor(tier: ApronTier, rules: ApronRules): Restrictions {
  if (tier === 'second_apron') return rules.secondApron;
  if (tier === 'first_apron') return rules.firstApron;
  return { canAggregate: true, maxTakebackPct: Infinity };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/cba/__tests__/apron.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/cba/apron.ts lib/cba/__tests__/apron.test.ts
git commit -m "feat: apron restrictions resolver with tests"
```

### Task 12: validateTrade.ts — happy path

**Files:**
- Create: `lib/cba/validateTrade.ts`, `lib/cba/__tests__/validateTrade.test.ts`
- Create: `lib/cba/__tests__/fixtures.ts`

- [ ] **Step 1: Create shared fixtures `lib/cba/__tests__/fixtures.ts`**

```ts
import type { SeasonCap, MatchingRules, ApronRules } from '@/lib/cba/types';

export const season: SeasonCap = { season: 'T', salaryCap: 100, taxLine: 140, firstApron: 150, secondApron: 160 };
export const matching: MatchingRules = { belowApronPct: 2.0, belowApronAdd: 5, apronTakebackPct: 1.10 };
export const apron: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.25 },
  secondApron: { canAggregate: false, maxTakebackPct: 1.10 },
};
```

- [ ] **Step 2: Write the failing test for a legal 2-team swap**

```ts
import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/lib/cba/validateTrade';
import { season, matching, apron } from './fixtures';
import type { TradeInput } from '@/lib/cba/types';

const base = { season, matching, apron };

describe('validateTrade happy path', () => {
  it('legal even swap between two over-cap teams is valid', () => {
    const input: TradeInput = {
      ...base,
      teams: [ { abbr: 'AAA', preTradeSalary: 120 }, { abbr: 'BBB', preTradeSalary: 120 } ],
      assets: [
        { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'Player A' },
        { id: 'b1', kind: 'player', salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'Player B' },
      ],
    };
    const result = validateTrade(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    const aaa = result.perTeam.find((t) => t.abbr === 'AAA')!;
    expect(aaa.outgoing).toBe(20);
    expect(aaa.incoming).toBe(20);
    expect(aaa.postSalary).toBe(120);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/cba/__tests__/validateTrade.test.ts`
Expected: FAIL (module not found).

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
    return {
      abbr: team.abbr,
      outgoing,
      incoming,
      postSalary,
      preTier: tierFor(team.preTradeSalary, season),
      postTier: tierFor(postSalary, season),
      playersOut: out.filter((a) => a.kind === 'player').length,
    };
  });

  for (const t of perTeam) {
    if (t.outgoing === 0 && t.incoming === 0) continue;
    const restr = restrictionsFor(t.preTier, apron);

    if (t.playersOut >= 2 && !restr.canAggregate) {
      errors.push({
        code: 'NO_AGGREGATION',
        teamAbbr: t.abbr,
        message: `${t.abbr} are above the second apron and cannot aggregate salaries in a trade.`,
      });
    }

    if (t.outgoing > 0) {
      const limit = maxIncomingSalary(t.outgoing, t.preTier, matching);
      if (t.incoming > limit) {
        errors.push({
          code: 'OVER_MATCH',
          teamAbbr: t.abbr,
          message: `${t.abbr} can take back at most ${fmt(limit)} for ${fmt(t.outgoing)} sent out, but are taking back ${fmt(t.incoming)}.`,
        });
      }
    }
  }

  return { valid: errors.length === 0, perTeam, errors };
}

function fmt(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n}`;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/cba/__tests__/validateTrade.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/cba/validateTrade.ts lib/cba/__tests__/validateTrade.test.ts lib/cba/__tests__/fixtures.ts
git commit -m "feat: validateTrade orchestrator (happy path) with tests"
```

### Task 13: validateTrade.ts — apron + matching failure cases

**Files:**
- Modify: `lib/cba/__tests__/validateTrade.test.ts`

- [ ] **Step 1: Add failing tests for the denial cases**

Append inside the describe block:
```ts
it('second-apron team sending 2 players gets aggregation error', () => {
  const input = {
    season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 165 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'a2', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A2' },
      { id: 'b1', kind: 'player' as const, salary: 38, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ],
  };
  const result = validateTrade(input);
  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.code === 'NO_AGGREGATION' && e.teamAbbr === 'AAA')).toBe(true);
});

it('over-cap team taking back too much salary gets match error', () => {
  const input = {
    season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 120 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 5, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'b1', kind: 'player' as const, salary: 40, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ],
  };
  // AAA sends 5 -> max incoming = 5*2 + 5 = 15; taking back 40 -> error
  const result = validateTrade(input);
  expect(result.errors.some((e) => e.code === 'OVER_MATCH' && e.teamAbbr === 'AAA')).toBe(true);
});

it('picks do not count toward aggregation or salary', () => {
  const input = {
    season, matching, apron,
    teams: [ { abbr: 'AAA', preTradeSalary: 165 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: [
      { id: 'a1', kind: 'player' as const, salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      { id: 'pk', kind: 'pick' as const, salary: 0, fromTeam: 'AAA', toTeam: 'BBB', label: '2027 1st' },
      { id: 'b1', kind: 'player' as const, salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    ],
  };
  const result = validateTrade(input);
  expect(result.errors.some((e) => e.code === 'NO_AGGREGATION')).toBe(false);
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/cba/__tests__/validateTrade.test.ts`
Expected: all passed (implementation from Task 12 already handles these). If any fail, fix `validateTrade.ts` minimally.

- [ ] **Step 3: Commit**

```bash
git add lib/cba/__tests__/validateTrade.test.ts
git commit -m "test: apron aggregation and matching denial cases"
```

### Task 14: Real constants module

**Files:**
- Create: `lib/cba/constants.ts`, `lib/cba/__tests__/constants.test.ts`

- [ ] **Step 1: Write `lib/cba/constants.ts`**

```ts
import type { SeasonCap, MatchingRules, ApronRules } from './types';

// VERIFY all dollar figures and rule percentages against an authoritative CBA
// reference before production. Engine logic is unit-tested with fixtures and does
// not depend on these exact numbers.
export const SEASON_2025_26: SeasonCap = {
  season: '2025-26',
  salaryCap: 154_600_000,
  taxLine: 187_900_000,
  firstApron: 195_900_000,
  secondApron: 207_800_000,
};

export const MATCHING_2025_26: MatchingRules = {
  belowApronPct: 2.0,        // VERIFY
  belowApronAdd: 250_000,    // VERIFY
  apronTakebackPct: 1.10,    // VERIFY
};

export const APRON_2025_26: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.25 },   // VERIFY
  secondApron: { canAggregate: false, maxTakebackPct: 1.10 }, // VERIFY
};
```

- [ ] **Step 2: Write a sanity test `lib/cba/__tests__/constants.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { SEASON_2025_26 } from '@/lib/cba/constants';

describe('constants', () => {
  it('cap landmarks are strictly increasing', () => {
    const c = SEASON_2025_26;
    expect(c.salaryCap).toBeLessThan(c.taxLine);
    expect(c.taxLine).toBeLessThan(c.firstApron);
    expect(c.firstApron).toBeLessThan(c.secondApron);
  });
});
```

- [ ] **Step 3: Run all engine tests**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add lib/cba/constants.ts lib/cba/__tests__/constants.test.ts
git commit -m "feat: 2025-26 cba constants (flagged for verification)"
```

---

## Phase 3 — Trade UI

### Task 15: Trade store

**Files:**
- Create: `lib/store/tradeStore.ts`, `lib/store/__tests__/tradeStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore } from '@/lib/store/tradeStore';

describe('tradeStore', () => {
  beforeEach(() => useTradeStore.getState().reset());
  it('adds a team and routes an asset', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' });
    s.routeAsset('a1', 'BBB');
    expect(useTradeStore.getState().assets['a1'].toTeam).toBe('BBB');
  });
  it('caps teams at 4 in v1', () => {
    const s = useTradeStore.getState();
    ['A','B','C','D','E'].forEach((x) => s.addTeam({ abbr: x, preTradeSalary: 100 }));
    expect(useTradeStore.getState().teams.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/store/__tests__/tradeStore.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/store/tradeStore.ts`**

```ts
import { create } from 'zustand';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

const MAX_TEAMS = 4; // v1 cap

interface TradeState {
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  addTeam: (t: TradeTeamInput) => void;
  removeTeam: (abbr: string) => void;
  addAsset: (a: TradeAsset) => void;
  routeAsset: (id: string, toTeam: string) => void;
  removeAsset: (id: string) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  teams: [],
  assets: {},
  addTeam: (t) => set((s) => s.teams.length >= MAX_TEAMS || s.teams.some((x) => x.abbr === t.abbr) ? s : { teams: [...s.teams, t] }),
  removeTeam: (abbr) => set((s) => ({
    teams: s.teams.filter((t) => t.abbr !== abbr),
    assets: Object.fromEntries(Object.entries(s.assets).filter(([, a]) => a.fromTeam !== abbr && a.toTeam !== abbr)),
  })),
  addAsset: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  routeAsset: (id, toTeam) => set((s) => ({ assets: { ...s.assets, [id]: { ...s.assets[id], toTeam } } })),
  removeAsset: (id) => set((s) => { const n = { ...s.assets }; delete n[id]; return { assets: n }; }),
  reset: () => set({ teams: [], assets: {} }),
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/store/__tests__/tradeStore.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/store/tradeStore.ts lib/store/__tests__/tradeStore.test.ts
git commit -m "feat: zustand trade store with team cap and asset routing"
```

### Task 16: Validation selector

**Files:**
- Create: `lib/store/selectValidation.ts`, `lib/store/__tests__/selectValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { selectValidation } from '@/lib/store/selectValidation';

it('builds a TradeInput from store shape and validates', () => {
  const result = selectValidation({
    teams: [ { abbr: 'AAA', preTradeSalary: 120 }, { abbr: 'BBB', preTradeSalary: 120 } ],
    assets: {
      a1: { id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
      b1: { id: 'b1', kind: 'player', salary: 20, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
    },
  });
  expect(result.valid).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/store/__tests__/selectValidation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/store/selectValidation.ts`**

```ts
import { validateTrade } from '@/lib/cba/validateTrade';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';
import type { TradeAsset, TradeTeamInput, TradeValidation } from '@/lib/cba/types';

export function selectValidation(state: { teams: TradeTeamInput[]; assets: Record<string, TradeAsset> }): TradeValidation {
  return validateTrade({
    season: SEASON_2025_26,
    matching: MATCHING_2025_26,
    apron: APRON_2025_26,
    teams: state.teams,
    assets: Object.values(state.assets),
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/store/__tests__/selectValidation.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/store/selectValidation.ts lib/store/__tests__/selectValidation.test.ts
git commit -m "feat: validation selector wiring store to engine"
```

### Task 17: AdSlot (CLS-safe placeholder)

**Files:**
- Create: `components/AdSlot.tsx`

- [ ] **Step 1: Implement `components/AdSlot.tsx`**

```tsx
const SIZES = {
  'footer-mobile': { w: 320, h: 50 },
  'footer-desktop': { w: 728, h: 90 },
  'tower': { w: 300, h: 600 },
  'rectangle': { w: 300, h: 250 },
} as const;

export function AdSlot({ size }: { size: keyof typeof SIZES }) {
  const { w, h } = SIZES[size];
  return (
    <div
      aria-label="advertisement"
      style={{ minWidth: w, minHeight: h }}
      className="flex items-center justify-center bg-neutral-100 text-neutral-400 text-xs border border-dashed border-neutral-300"
    >
      Ad {w}×{h}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AdSlot.tsx
git commit -m "feat: CLS-safe AdSlot placeholder component"
```

### Task 18: AssetRow + TeamColumn + ValidationFeed

**Files:**
- Create: `components/AssetRow.tsx`, `components/TeamColumn.tsx`, `components/ValidationFeed.tsx`

- [ ] **Step 1: Implement `components/AssetRow.tsx`**

```tsx
'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

export function AssetRow({ asset, teams }: { asset: TradeAsset; teams: TradeTeamInput[] }) {
  const routeAsset = useTradeStore((s) => s.routeAsset);
  const dests = teams.filter((t) => t.abbr !== asset.fromTeam);
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span>{asset.label}{asset.kind === 'player' ? ` — $${(asset.salary / 1_000_000).toFixed(1)}M` : ''}</span>
      <select
        value={asset.toTeam}
        onChange={(e) => routeAsset(asset.id, e.target.value)}
        className="border rounded px-1 py-0.5"
      >
        <option value={asset.fromTeam}>Stay</option>
        {dests.map((t) => <option key={t.abbr} value={t.abbr}>→ {t.abbr}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/TeamColumn.tsx`**

```tsx
'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import { AssetRow } from './AssetRow';
import type { TeamResult } from '@/lib/cba/types';

const TIER_LABEL: Record<string, string> = {
  below_cap: 'Below cap', over_cap: 'Over cap', over_tax: 'Over tax',
  first_apron: 'First apron', second_apron: 'Second apron',
};

export function TeamColumn({ abbr, result }: { abbr: string; result?: TeamResult }) {
  const assets = useTradeStore((s) => Object.values(s.assets));
  const teams = useTradeStore((s) => s.teams);
  const own = assets.filter((a) => a.fromTeam === abbr);
  const incoming = assets.filter((a) => a.toTeam === abbr && a.fromTeam !== abbr);
  return (
    <div className="flex-1 min-w-[240px] border rounded p-3">
      <div className="font-bold">{abbr}</div>
      {result && (
        <div className="text-xs text-neutral-500 mb-2">
          {TIER_LABEL[result.postTier]} · ${(result.postSalary / 1_000_000).toFixed(1)}M
        </div>
      )}
      <div className="font-medium text-xs uppercase text-neutral-400">Roster</div>
      {own.map((a) => <AssetRow key={a.id} asset={a} teams={teams} />)}
      {incoming.length > 0 && <div className="font-medium text-xs uppercase text-neutral-400 mt-2">Incoming</div>}
      {incoming.map((a) => <div key={a.id} className="text-sm py-1">{a.label}</div>)}
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/ValidationFeed.tsx`**

```tsx
'use client';
import type { TradeValidation } from '@/lib/cba/types';

export function ValidationFeed({ validation }: { validation: TradeValidation }) {
  if (validation.valid) {
    return <div className="rounded bg-green-50 text-green-800 p-3 text-sm">Trade is legal under the CBA.</div>;
  }
  return (
    <div className="rounded bg-red-50 text-red-800 p-3 text-sm space-y-1">
      {validation.errors.map((e, i) => <div key={i}>Trade Denied: {e.message}</div>)}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/AssetRow.tsx components/TeamColumn.tsx components/ValidationFeed.tsx
git commit -m "feat: team column, asset row, and validation feed components"
```

### Task 19: TradeMatrix + page wiring

**Files:**
- Create: `components/TradeMatrix.tsx`, `components/ExecuteTradeButton.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement `components/ExecuteTradeButton.tsx`**

```tsx
'use client';
export function ExecuteTradeButton({ valid, onExecute }: { valid: boolean; onExecute: () => void }) {
  return (
    <button
      onClick={onExecute}
      className={`w-full py-3 rounded font-bold text-white ${valid ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-neutral-400 cursor-not-allowed'}`}
      disabled={!valid}
    >
      Execute Trade
    </button>
  );
}
```

- [ ] **Step 2: Implement `components/TradeMatrix.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { selectValidation } from '@/lib/store/selectValidation';
import { TeamColumn } from './TeamColumn';
import { ValidationFeed } from './ValidationFeed';
import { ExecuteTradeButton } from './ExecuteTradeButton';

export function TradeMatrix() {
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  const validation = useMemo(() => selectValidation({ teams, assets }), [teams, assets]);
  const byTeam = useMemo(() => Object.fromEntries(validation.perTeam.map((t) => [t.abbr, t])), [validation]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto snap-x">
        {teams.map((t) => (
          <div key={t.abbr} className="snap-start"><TeamColumn abbr={t.abbr} result={byTeam[t.abbr]} /></div>
        ))}
      </div>
      <ValidationFeed validation={validation} />
      <ExecuteTradeButton valid={validation.valid && teams.length >= 2} onExecute={() => { /* Phase 5 interstitial */ }} />
    </div>
  );
}
```

- [ ] **Step 3: Wire `app/page.tsx`** (load teams + rosters server-side, hydrate the store via a client init component)

```tsx
import { getTeams, getRoster } from '@/lib/data/queries';
import { TradeBoard } from '@/components/TradeBoard';

export default async function Home() {
  const teams = await getTeams();
  const rosters = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.abbr, await getRoster(t.id, '2025-26')] as const))
  );
  return (
    <main className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">NBA Trade Machine</h1>
      <TradeBoard teams={teams} rosters={rosters} />
    </main>
  );
}
```

- [ ] **Step 4: Create `components/TradeBoard.tsx`** (client init: lets the user pick teams to add, seeds assets from rosters)

```tsx
'use client';
import { useEffect } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import { TradeMatrix } from './TradeMatrix';
import type { DbTeam } from '@/lib/data/types';
import type { RosterEntry } from '@/lib/data/queries';

export function TradeBoard({ teams, rosters }: { teams: DbTeam[]; rosters: Record<string, RosterEntry[]> }) {
  const storeTeams = useTradeStore((s) => s.teams);
  const addTeam = useTradeStore((s) => s.addTeam);
  const addAsset = useTradeStore((s) => s.addAsset);

  function add(team: DbTeam) {
    const total = rosters[team.abbr].reduce((s, r) => s + r.salary, 0);
    addTeam({ abbr: team.abbr, preTradeSalary: total });
    rosters[team.abbr].forEach((r) =>
      addAsset({ id: `${team.abbr}-${r.playerId}`, kind: 'player', salary: r.salary, fromTeam: team.abbr, toTeam: team.abbr, label: r.name }),
    );
  }

  useEffect(() => () => useTradeStore.getState().reset(), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {teams.filter((t) => !storeTeams.some((s) => s.abbr === t.abbr)).map((t) => (
          <button key={t.id} onClick={() => add(t)} className="px-3 py-1 border rounded text-sm" disabled={storeTeams.length >= 4}>
            + {t.abbr}
          </button>
        ))}
      </div>
      {storeTeams.length >= 2 ? <TradeMatrix /> : <p className="text-neutral-500">Add at least two teams to start.</p>}
    </div>
  );
}
```

- [ ] **Step 5: Manually verify in browser**

Run: `npm run dev`, open http://localhost:3000, add 2–3 teams, route players, confirm the validation feed updates live and shows a descriptive denial when you take back too much salary.
Expected: live updates, no console errors, no layout shift.

- [ ] **Step 6: Commit**

```bash
git add components/TradeMatrix.tsx components/ExecuteTradeButton.tsx components/TradeBoard.tsx app/page.tsx
git commit -m "feat: trade matrix UI wired to live CBA validation"
```

### Task 20: Layout shell with ad slots + responsive

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add sticky footer ad + side towers to `app/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { AdSlot } from '@/components/AdSlot';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-[60px]">
        <div className="flex justify-center gap-4">
          <aside className="hidden xl:block"><AdSlot size="tower" /></aside>
          <div className="flex-1 max-w-6xl">{children}</div>
          <aside className="hidden xl:block"><AdSlot size="tower" /></aside>
        </div>
        <footer className="fixed bottom-0 inset-x-0 flex justify-center bg-white border-t py-1 z-10">
          <div className="md:hidden"><AdSlot size="footer-mobile" /></div>
          <div className="hidden md:block"><AdSlot size="footer-desktop" /></div>
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify responsive behavior in browser**

Run: `npm run dev`; resize to mobile width — towers hide, columns scroll horizontally (carousel), sticky footer remains and swaps to 320×50.
Expected: matches the spec wireframe; no CLS.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: three-tier layout shell with sticky footer and side tower ads"
```

---

## Phase 4 — Sharing

### Task 21: Save/load trade API

**Files:**
- Create: `app/api/trade/route.ts`
- Modify: `lib/data/queries.ts` (add `saveTrade`, `getTrade`)

- [ ] **Step 1: Add `saveTrade` and `getTrade` to `lib/data/queries.ts`**

```ts
import { nanoid } from 'nanoid';

export interface TradePayload { teams: unknown; assets: unknown; }

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
```

- [ ] **Step 2: Implement `app/api/trade/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { saveTrade } from '@/lib/data/queries';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = await saveTrade({ teams: body.teams, assets: body.assets });
  return NextResponse.json({ slug });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/trade/route.ts lib/data/queries.ts
git commit -m "feat: persist and load shared trades"
```

### Task 22: Generate-link button + share page

**Files:**
- Create: `app/trade/[slug]/page.tsx`, `components/GenerateLinkButton.tsx`
- Modify: `components/TradeMatrix.tsx` (mount the button)

- [ ] **Step 1: Implement `components/GenerateLinkButton.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';

export function GenerateLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const teams = useTradeStore((s) => s.teams);
  const assets = useTradeStore((s) => s.assets);
  async function gen() {
    const res = await fetch('/api/trade', { method: 'POST', body: JSON.stringify({ teams, assets }) });
    const { slug } = await res.json();
    setUrl(`${location.origin}/trade/${slug}`);
  }
  return (
    <div className="space-y-2">
      <button onClick={gen} className="px-4 py-2 border rounded font-medium">Generate Trade Link</button>
      {url && <input readOnly value={url} className="w-full border rounded p-2 text-sm" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
```

- [ ] **Step 2: Mount `<GenerateLinkButton />` under the ExecuteTradeButton in `components/TradeMatrix.tsx`**

Add import and render `<GenerateLinkButton />` after `<ExecuteTradeButton .../>`.

- [ ] **Step 3: Implement read-only `app/trade/[slug]/page.tsx`**

```tsx
import { getTrade } from '@/lib/data/queries';
import { validateTrade } from '@/lib/cba/validateTrade';
import { SEASON_2025_26, MATCHING_2025_26, APRON_2025_26 } from '@/lib/cba/constants';
import { ValidationFeed } from '@/components/ValidationFeed';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import { notFound } from 'next/navigation';

export default async function SharedTrade({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getTrade(slug);
  if (!payload) notFound();
  const teams = payload.teams as TradeTeamInput[];
  const assets = Object.values(payload.assets as Record<string, TradeAsset>);
  const validation = validateTrade({ season: SEASON_2025_26, matching: MATCHING_2025_26, apron: APRON_2025_26, teams, assets });
  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Proposed Trade</h1>
      {teams.map((t) => (
        <div key={t.abbr} className="border rounded p-3">
          <div className="font-bold">{t.abbr}</div>
          {assets.filter((a) => a.toTeam === t.abbr).map((a) => <div key={a.id} className="text-sm">Receives: {a.label}</div>)}
        </div>
      ))}
      <ValidationFeed validation={validation} />
    </main>
  );
}
```

- [ ] **Step 4: Verify end-to-end in browser**

Run: `npm run dev`; build a trade, click Generate Trade Link, open the URL in a new tab, confirm the read-only page shows the same teams/assets and validation result.
Expected: share round-trips correctly.

- [ ] **Step 5: Commit**

```bash
git add app/trade components/GenerateLinkButton.tsx components/TradeMatrix.tsx
git commit -m "feat: generate persistent trade links and read-only share page"
```

### Task 23: OG image for share page

**Files:**
- Create: `app/trade/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Implement dynamic OG image with `next/og`**

```tsx
import { ImageResponse } from 'next/og';
import { getTrade } from '@/lib/data/queries';
import type { TradeTeamInput } from '@/lib/cba/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const payload = await getTrade(params.slug);
  const teams = (payload?.teams as TradeTeamInput[] | undefined) ?? [];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0b1020', color: 'white', fontSize: 64 }}>
        <div style={{ fontSize: 40, opacity: 0.7 }}>NBA Trade Machine</div>
        <div>{teams.map((t) => t.abbr).join('  ↔  ')}</div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verify the OG image renders**

Run: `npm run dev`; open `http://localhost:3000/trade/<slug>/opengraph-image`.
Expected: a 1200×630 PNG with the team abbreviations and site name.

- [ ] **Step 3: Run the full test suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add app/trade/[slug]/opengraph-image.tsx
git commit -m "feat: dynamic Open Graph image for shared trades"
```

---

## Follow-on plans (not in this plan)

- **Phase 5 — Monetization + polish:** real ad-network integration (AdSense/NitroPay, async/defer), 1.5s processing interstitial, share-page 300×250, mobile carousel refinements.
- **Phase 6 — Data + depth:** Python weekly scraper writing to Supabase, draft-pick protection editing UI, expand to 5–6 teams, below-cap room matching path, hard-cap trigger modeling, Stepien-rule pick checks.

---

## Self-Review

**Spec coverage check (spec §-by-§):**
- §2 decisions (stack/data/v1 scope) → Tasks 1–2 (stack), 4 (seed), all phases scoped to v1. ✓
- §4 data model (6 tables) → Task 3 migration. ✓
- §5 CBA engine (constants/matching/apron/validateTrade) → Tasks 8–14. ✓
- §6 frontend (store, TradeMatrix, TeamColumn, AssetRow, ValidationFeed, ExecuteTradeButton, AdSlot, share) → Tasks 15–23. ✓
- §7 non-functional (client-side validation, CLS-safe ads, mobile carousel) → Tasks 16/17/20. ✓
- §8 phasing → Phases 0–4 here; 5–6 listed as follow-on. ✓
- §10 verify-constants → Task 14 VERIFY flags + constants test. ✓

**Placeholder scan:** Task 4 Step 3 says "fill realistic rosters" — this is intentional data entry, not a logic placeholder; the JSON shape is fully specified. All code steps show complete code. No "TODO/handle edge cases" in logic.

**Type consistency:** `TradeAsset`, `TradeTeamInput`, `TradeInput`, `TradeValidation`, `TeamResult`, `ApronTier`, `SeasonCap`, `MatchingRules`, `ApronRules` defined in Task 8 and used identically in Tasks 10–23. `tierFor`, `maxIncomingSalary`, `restrictionsFor`, `validateTrade`, `selectValidation`, `saveTrade`, `getTrade`, `useTradeStore` names consistent across tasks. ✓
