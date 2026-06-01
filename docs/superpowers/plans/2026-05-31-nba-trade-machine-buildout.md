# NBA Trade Machine Build-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the working-but-empty v1 (correct CBA engine + UI + share, rosters for only 2/30 teams) to a publicly deployed product with accurate, current contracts for **all 30 teams** in ~1 week (Milestone 0), then build out Phases 6/7/5 as gated fast-follow milestones.

**Architecture:** Keep the v1 architecture (pure `lib/cba/` engine, Zustand store, Supabase + filesystem-fallback data layer, Next.js App Router on Vercel). The week-1 work is overwhelmingly data: retarget the Python scraper at Basketball-Reference's single multi-year contracts page, audit it against a second source, load all 30 teams, and deploy. No engine rewrite.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind / Zustand / Supabase (supabase-js) / Vitest / nanoid; Python 3 + httpx + selectolax + pytest for the scraper; Vercel for hosting.

**Source of truth:** `docs/superpowers/specs/2026-05-31-nba-trade-machine-master-prd.md`. This plan implements Milestone 0 in full; Milestones 1-3 are outlined for their own future plans (§ Follow-on).

**Accuracy is the release gate.** A wrong current-season salary is a P0 bug. Every data task ends with a verification step; the override layer (`source:"override"`) always wins the merge and is the correction mechanism.

---

## File Structure (Milestone 0)

```
scripts/scraper/
  fixtures/bbref_contracts_sample.html   CREATE  captured real page (test input)
  parse.py                               REWRITE single-page multi-year + option markers
  test_parse.py                          REWRITE assert against the real fixture
  normalize.py                           REWRITE fetch one page; emit multi-year out/*.json
  fetch.py                               MODIFY  delay-before-request; BBRef-friendly UA
scripts/
  audit.ts                               CREATE  cross-source salary audit / sanity report
data/overrides/
  contracts.json                         APPEND  same-day corrections found by audit
  players.json                           CREATE  override players referenced by corrections
app/
  layout.tsx                             MODIFY  SEO/OG/Twitter metadata + provenance footer
  sitemap.ts                             CREATE  basic sitemap
  trade/[slug]/page.tsx                  MODIFY  richer share page (salaries + verdict)
lib/data/queries.ts                      (unchanged; already falls back to local mode)
supabase/migrations/0001_init.sql        (unchanged; applied during deploy)
```

External (no repo file): Supabase project, Vercel project + env vars, GitHub Action secrets, analytics + error-monitoring setup.

---

## Phase A — Data source + scraper retarget (Days 1-2)

### Task 1: Capture a real fixture + ToS go/no-go gate

**Files:**
- Create: `scripts/scraper/fixtures/bbref_contracts_sample.html`

- [ ] **Step 1: Confirm the source and its terms.** Open `https://www.basketball-reference.com/contracts/players.html`. Confirm the page lists every player with a team column and one column per future contract season. Read Sports Reference's bot/ToS policy (they ask for ≤ 20 requests/min and no bulk redistribution). We fetch this *one page* weekly + on demand, throttled. If the terms or active blocking make it untenable, STOP and switch to the paid-API fallback (sportsdata.io) noted in PRD §7 — the downstream import/merge is unchanged.

- [ ] **Step 2: Save the live HTML to the fixture path** (used only by the test; do not commit anything that violates ToS — a single HTML sample for an offline parser test is standard practice).

```bash
curl -sL -A "Mozilla/5.0 (compatible; NBATradeMachine/1.0)" \
  https://www.basketball-reference.com/contracts/players.html \
  -o scripts/scraper/fixtures/bbref_contracts_sample.html
```

- [ ] **Step 3: Inspect the table structure.** Confirm the data table id and that cells use `data-stat` attributes. Note the player cell (`data-stat="player"`), team cell (`data-stat="team_id"`), the per-year salary cells (`data-stat="y1"`, `y2`, …), and how option/guarantee is marked (cell class or trailing note). Record the season label for each `yN` column from the table header.

- [ ] **Step 4: Commit the fixture**

```bash
git add scripts/scraper/fixtures/bbref_contracts_sample.html
git commit -m "chore: capture basketball-reference contracts fixture for parser TDD"
```

### Task 2: Rewrite `parse.py` for the single multi-year page (TDD)

Parse ALL players × ALL contract years with option/guarantee detection. One page in → many multi-year rows out.

**Files:**
- Rewrite: `scripts/scraper/parse.py`
- Rewrite: `scripts/scraper/test_parse.py`

- [ ] **Step 1: Write the failing test** (assert against players actually present in your captured fixture; replace the example names/numbers with real ones you read from the fixture in Task 1 Step 3)

```python
# scripts/scraper/test_parse.py
from pathlib import Path
from parse import parse_contracts

FIXTURE = Path(__file__).parent / "fixtures" / "bbref_contracts_sample.html"


def rows():
    return parse_contracts(FIXTURE.read_text(encoding="utf-8"))


def test_extracts_many_players_across_all_teams():
    r = rows()
    teams = {x["team_id"] for x in r}
    assert len(r) > 300            # ~450-540 player-rows expected across the league
    assert len(teams) >= 25        # most/all teams represented on the page


def test_row_shape_and_current_season_salary():
    r = rows()
    sample = next(x for x in r if x["name"] == "REPLACE_WITH_REAL_PLAYER")
    assert sample["team_id"] == "REPLACE_WITH_REAL_TEAM_ID"      # lowercase abbr, e.g. "okc"
    assert sample["season"] == "2025-26"
    assert sample["salary"] == REPLACE_WITH_REAL_SALARY_INT       # exact dollars, no separators
    assert sample["option_type"] in {"guaranteed", "player", "team", "eto", "two_way"}
    assert sample["guarantee_status"] in {"full", "partial", "non_guaranteed"}
    assert sample["source"] == "scrape"


def test_captures_future_contract_years():
    # a player known to have multiple guaranteed years in your fixture
    r = [x for x in rows() if x["name"] == "REPLACE_WITH_MULTIYEAR_PLAYER"]
    seasons = {x["season"] for x in r}
    assert "2025-26" in seasons and len(seasons) >= 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd scripts/scraper && python -m pytest test_parse.py -v`
Expected: FAIL (`cannot import name 'parse_contracts'`).

- [ ] **Step 3: Implement `parse.py`** (confirm the three marked values against your fixture from Task 1; BBRef uses `data-stat` attributes, so selectors are stable)

```python
"""Parse Basketball-Reference's single contracts page into normalized contract rows.

One page (basketball-reference.com/contracts/players.html) lists every player with one
salary column per future season. We emit one row per (player, season) so multi-year
contracts become multiple rows, matching the contracts schema. Option/guarantee flags are
read from BBRef cell markup. TDD'd against fixtures/bbref_contracts_sample.html.
"""

from selectolax.parser import HTMLParser

TABLE_SELECTOR = "table#player-contracts"          # CONFIRM id against fixture
YEAR_STATS = ["y1", "y2", "y3", "y4", "y5", "y6"]  # per-season salary columns


def _to_int(text: str) -> int:
    return int("".join(ch for ch in text if ch.isdigit()) or "0")


def _season_map(table) -> dict[str, str]:
    """Map yN data-stat -> season label ('2025-26') from the header row."""
    out: dict[str, str] = {}
    head = table.css_first("thead")
    if head is None:
        return out
    for th in head.css("th[data-stat]"):
        stat = th.attributes.get("data-stat", "")
        if stat in YEAR_STATS:
            out[stat] = th.text(strip=True)
    return out


def _option(cell) -> tuple[str, str]:
    """Return (option_type, guarantee_status) from a salary cell's markup/markers."""
    cls = (cell.attributes.get("class") or "")
    txt = cell.text()
    if "non-guaranteed" in cls or "(NG)" in txt:
        return "non_guaranteed", "non_guaranteed"
    if "partial" in cls or "(PG)" in txt:
        return "guaranteed", "partial"
    if "player-option" in cls or "(PO)" in txt:
        return "player", "full"
    if "team-option" in cls or "(TO)" in txt:
        return "team", "full"
    if "early-termination" in cls or "(ETO)" in txt:
        return "eto", "full"
    return "guaranteed", "full"


def parse_contracts(html: str) -> list[dict]:
    tree = HTMLParser(html)
    table = tree.css_first(TABLE_SELECTOR)
    if table is None:
        return []
    seasons = _season_map(table)
    out: list[dict] = []
    for tr in table.css("tbody tr"):
        name_node = tr.css_first('[data-stat="player"] a') or tr.css_first('[data-stat="player"]')
        team_node = tr.css_first('[data-stat="team_id"]')
        if name_node is None or team_node is None:
            continue
        team_id = team_node.text(strip=True).lower()
        if not team_id:
            continue
        name = name_node.text(strip=True)
        for stat in YEAR_STATS:
            cell = tr.css_first(f'[data-stat="{stat}"]')
            if cell is None:
                continue
            salary = _to_int(cell.text())
            if salary == 0:
                continue
            season = seasons.get(stat)
            if not season:
                continue
            opt, gtd = _option(cell)
            out.append(
                {
                    "name": name,
                    "team_id": team_id,
                    "season": season,
                    "salary": salary,
                    "option_type": opt,
                    "guarantee_status": gtd,
                    "no_trade_clause": False,  # BBRef does not list NTCs; override layer adds them
                    "source": "scrape",
                }
            )
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest test_parse.py -v`
Expected: PASS (3 tests). If option markers differ from the guesses in `_option`, adjust them to match the fixture markup and re-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/scraper/parse.py scripts/scraper/test_parse.py
git commit -m "feat: parse basketball-reference single-page multi-year contracts with option flags"
```

### Task 3: Retarget `normalize.py` + `fetch.py` to one page; produce all-30 data

**Files:**
- Rewrite: `scripts/scraper/normalize.py`
- Modify: `scripts/scraper/fetch.py`

- [ ] **Step 1: Fix `fetch.py`** (delay BEFORE the request so repeated calls are polite; keep a real UA)

```python
"""Thin, swappable network layer. One throttled GET. Confirm source ToS (PRD section 7)."""

import time

import httpx

USER_AGENT = "Mozilla/5.0 (compatible; NBATradeMachine/1.0; +https://nbatrademachine.app)"
_DELAY_SECONDS = 3.0  # Sports Reference asks for a low request rate; we fetch one page


def fetch_html(url: str) -> str:
    time.sleep(_DELAY_SECONDS)
    resp = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=30.0, follow_redirects=True)
    resp.raise_for_status()
    return resp.text
```

- [ ] **Step 2: Rewrite `normalize.py`** (single source URL; stable ids; multi-year rows)

```python
"""Fetch the single contracts page, parse, and write normalized players.json +
contracts.json to scripts/scraper/out/ (the 'scrape' layer consumed by scripts/import.ts).
ids match the import merge scheme: p_<name_slug> and c_<name_slug>_<season>.
"""

import json
import pathlib
import re

from fetch import fetch_html
from parse import parse_contracts

SOURCE_URL = "https://www.basketball-reference.com/contracts/players.html"


def slug(name: str) -> str:
    return "p_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def main() -> None:
    rows = parse_contracts(fetch_html(SOURCE_URL))
    players: dict[str, dict] = {}
    contracts: list[dict] = []
    for row in rows:
        pid = slug(row["name"])
        players[pid] = {
            "id": pid,
            "name": row["name"],
            "position": None,
            "team_id": row["team_id"],
            "age": None,
            "years_of_service": None,
        }
        contracts.append(
            {
                "id": f"c_{pid[2:]}_{row['season']}",
                "player_id": pid,
                "season": row["season"],
                "salary": row["salary"],
                "option_type": row["option_type"],
                "guarantee_status": row["guarantee_status"],
                "no_trade_clause": row["no_trade_clause"],
                "source": row["source"],
            }
        )
    out = pathlib.Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)
    (out / "players.json").write_text(json.dumps(list(players.values()), indent=2), encoding="utf-8")
    (out / "contracts.json").write_text(json.dumps(contracts, indent=2), encoding="utf-8")
    print(f"wrote {len(players)} players, {len(contracts)} contracts across "
          f"{len({p['team_id'] for p in players.values()})} teams")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it against the live page**

Run: `cd scripts/scraper && python -m pip install -r requirements.txt && python normalize.py`
Expected: `wrote ~450-540 players, ~700-1100 contracts across 30 teams`. If team_ids on BBRef differ from our ids (e.g. `BRK` vs `bkn`, `CHO` vs `cha`, `PHO` vs `phx`), add a small mapping dict in `normalize.py` (`BBREF_TEAM_FIX = {"brk": "bkn", "cho": "cha", "pho": "phx"}`) and apply it to `row["team_id"]`.

- [ ] **Step 4: Spot-check the output** — open `scripts/scraper/out/players.json`; confirm all 30 team_ids appear and counts look like full rosters (~13-18 per team). Confirm a known star's current-season salary is exact.

- [ ] **Step 5: Commit** (commit the scraper code; `out/` is generated data — keep it out of git via `.gitignore`, it is rebuilt by the refresh action and the import reads it locally)

```bash
git add scripts/scraper/normalize.py scripts/scraper/fetch.py
git commit -m "feat: scrape full league contracts from one source page into normalized JSON"
```

---

## Phase B — Accuracy audit (Day 3, the moat task)

### Task 4: Cross-source salary audit script

**Files:**
- Create: `scripts/audit.ts`

- [ ] **Step 1: Implement `scripts/audit.ts`** (uses the same local merge the app uses, so it audits exactly what ships)

```ts
// Sanity + accuracy report over the merged dataset (seed < scrape < override).
// Prints the top-N current-season salaries for eyeball cross-check vs HoopsHype/Spotrac,
// plus structural flags. Run: npx tsx scripts/audit.ts
import { localTeams, localRoster } from '@/lib/data/local';

const SEASON = '2025-26';
const fmt = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

function main() {
  const teams = localTeams();
  const all = teams.flatMap((t) => localRoster(t.id, SEASON).map((r) => ({ team: t.abbr, ...r })));

  const empty = teams.filter((t) => localRoster(t.id, SEASON).length === 0);
  const dupes = new Map<string, number>();
  all.forEach((r) => dupes.set(r.playerId, (dupes.get(r.playerId) ?? 0) + 1));
  const duplicated = [...dupes.entries()].filter(([, n]) => n > 1);

  console.log(`Teams: ${teams.length}  Players: ${all.length}  Empty rosters: ${empty.length}`);
  if (empty.length) console.log('  EMPTY:', empty.map((t) => t.abbr).join(', '));
  if (duplicated.length) console.log('  DUPLICATE playerIds:', duplicated.map(([id]) => id).join(', '));

  console.log('\nTop 30 current-season salaries (verify each vs a second source):');
  all.sort((a, b) => b.salary - a.salary).slice(0, 30)
    .forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${fmt(r.salary).padStart(9)}  ${r.name} (${r.team})`));

  const perTeam = teams.map((t) => ({ abbr: t.abbr, total: localRoster(t.id, SEASON).reduce((s, r) => s + r.salary, 0) }));
  console.log('\nTeam total salary (sanity — most should be $120M-$220M):');
  perTeam.sort((a, b) => b.total - a.total).forEach((t) => console.log(`  ${t.abbr}  ${fmt(t.total)}`));

  if (empty.length || duplicated.length) { console.error('\nAUDIT FAILED: fix empties/dupes before launch.'); process.exit(1); }
}
main();
```

- [ ] **Step 2: Run the audit**

Run: `npx tsx scripts/audit.ts`
Expected: 30 teams, 0 empty rosters, 0 duplicate ids; top salaries and team totals in believable ranges.

- [ ] **Step 3: Cross-check** the printed top-30 salaries and 4-5 contender team totals against HoopsHype (`hoopshype.com/salaries/players/`). List every discrepancy.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit.ts
git commit -m "feat: cross-source salary audit and dataset sanity report"
```

### Task 5: Override corrections for discrepancies + recent moves

**Files:**
- Create: `data/overrides/players.json`
- Modify: `data/overrides/contracts.json`

- [ ] **Step 1: For each discrepancy** from Task 4 Step 3 (and any extension/signing newer than the scrape), add/replace the player in `data/overrides/players.json` and the contract year(s) in `data/overrides/contracts.json`. `source` MUST be `"override"` so it wins the merge. Use the same id scheme (`p_<slug>`, `c_<slug>_<season>`) so override rows replace scraped rows by id. Example shape:

```json
// data/overrides/players.json
[
  { "id": "p_example_name", "name": "Example Name", "position": "G", "team_id": "lal", "age": 27, "years_of_service": 6 }
]
```
```json
// data/overrides/contracts.json  (append to the existing array)
[
  { "id": "c_example_name_2025-26", "player_id": "p_example_name", "season": "2025-26", "salary": 41200000, "option_type": "guaranteed", "guarantee_status": "full", "no_trade_clause": true, "source": "override" }
]
```

- [ ] **Step 2: Re-run the audit** to confirm corrections landed and nothing broke.

Run: `npx tsx scripts/audit.ts`
Expected: discrepancies resolved; still 0 empty/dupe.

- [ ] **Step 3: Commit**

```bash
git add data/overrides/players.json data/overrides/contracts.json
git commit -m "fix: override corrections for audited salary discrepancies and recent moves"
```

---

## Phase C — App wiring on real data (Day 4)

### Task 6: Verify and harden full-roster rendering

**Files:**
- Modify: `components/TradeBoard.tsx` (only if the device check surfaces an issue)

- [ ] **Step 1: Run the app on local data** (no Supabase env set ⇒ `queries.ts` uses the filesystem layer)

Run: `npm run dev`, open `http://localhost:3000`.

- [ ] **Step 2: Manually verify** with real rosters: add 3 teams; each column lists that team's full roster (~13-18 players) with year-by-year contracts on cards; `preTradeSalary` (team total) matches the audit's team total; route 2-3 players across teams; the validation feed gives a correct verdict with descriptive denials; no console errors; no React key warnings.

- [ ] **Step 3: If the team-add control is unwieldy** with all 30 teams, confirm the `+ ABBR` buttons wrap and are tappable; only fix if broken (YAGNI — selects/buttons already scale). If a real bug appears (e.g. duplicate asset ids across teams), fix it minimally in `TradeBoard.tsx` and note it in the commit.

- [ ] **Step 4: Commit only if changed**

```bash
git add components/TradeBoard.tsx
git commit -m "fix: harden full-roster rendering on real 30-team data"
```

### Task 7: Richer share page (salaries + verdict + who-gets-what)

**Files:**
- Modify: `app/trade/[slug]/page.tsx`

- [ ] **Step 1: Replace the share page body** so each team card shows incoming assets with salaries and the page shows the validation verdict (it already imports `selectValidation` and `ValidationFeed`)

```tsx
import { getTrade } from '@/lib/data/queries';
import { selectValidation } from '@/lib/store/selectValidation';
import { ValidationFeed } from '@/components/ValidationFeed';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import { notFound } from 'next/navigation';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

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
        {teams.map((t) => {
          const incoming = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
          const outgoing = list.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
          const net = incoming.reduce((s, a) => s + a.salary, 0) - outgoing.reduce((s, a) => s + a.salary, 0);
          return (
            <div key={t.abbr} className="rounded border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold">{t.abbr}</span>
                <span className="text-xs tabular-nums text-neutral-500">Net {net >= 0 ? '+' : ''}{m(net)}</span>
              </div>
              {incoming.map((a) => <div key={a.id} className="text-sm text-emerald-700">+ {a.label} {a.kind === 'player' ? `(${m(a.salary)})` : ''}</div>)}
              {outgoing.map((a) => <div key={a.id} className="text-sm text-neutral-500">− {a.label} {a.kind === 'player' ? `(${m(a.salary)})` : ''}</div>)}
            </div>
          );
        })}
      </div>
      <ValidationFeed validation={validation} />
    </main>
  );
}
```

- [ ] **Step 2: Verify** — in dev, build a 3-team trade, Generate Trade Link, open it; confirm every team shows incoming (+) and outgoing (−) with salaries, net change, and the verdict. `/trade/<slug>/opengraph-image` still renders all teams.

- [ ] **Step 3: Commit**

```bash
git add app/trade/[slug]/page.tsx
git commit -m "feat: richer share page with per-team salaries, net change, and verdict"
```

---

## Phase D — Deploy + ops (Day 5)

> External-service config (no repo files). Steps are exact; values come from the dashboards.

### Task 8: Provision Supabase and load all 30 teams

- [ ] **Step 1: Create a Supabase project** (or use the Supabase MCP `create_project`). Note the project URL, anon key, and service-role key.

- [ ] **Step 2: Apply the schema** — run `supabase/migrations/0001_init.sql` via the Supabase MCP `apply_migration` (name `0001_init`) or the SQL editor. Verify 10 tables via `list_tables`.

- [ ] **Step 3: Create `.env.local`** (gitignored) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 4: Import** — `cd scripts/scraper && python normalize.py` (rebuild `out/`), then from repo root `npm run seed`. Expect `upserted N into season_cap/teams/players/contracts`. Re-run once to confirm idempotency.

- [ ] **Step 5: Verify in Supabase** — `players` ≈ 450-540 rows across 30 teams; `contracts` has multi-year rows; `season_cap` has 2025-26.

### Task 9: Deploy to Vercel

- [ ] **Step 1: Import the repo into Vercel** (framework auto-detected as Next.js).

- [ ] **Step 2: Set Vercel env vars** (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. With these set, `queries.ts` uses Supabase (so share links persist — the filesystem fallback does NOT persist on Vercel's serverless FS).

- [ ] **Step 3: Deploy and smoke-test the public URL** — home loads all 30 teams; build + share a trade; reopen the share link in a fresh browser (persistence proven); OG image renders.

- [ ] **Step 4: Wire the refresh Action secrets** — in GitHub repo settings add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so `.github/workflows/refresh-data.yml` runs; trigger it manually once (`workflow_dispatch`) and confirm it scrapes + upserts. (Update the workflow's scraper step to `python normalize.py` if it still references the old per-team flow.)

### Task 10: SEO metadata, sitemap, provenance

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/sitemap.ts`

- [ ] **Step 1: Expand metadata + add a provenance footer in `app/layout.tsx`** (merge into the existing layout; keep the current ad slots)

```tsx
export const metadata = {
  metadataBase: new URL('https://nbatrademachine.app'), // set to the real deployed origin
  title: 'NBA Trade Machine — Accurate Multi-Team Trade Simulator',
  description:
    'Build 2-4 team NBA trades with real current contracts and exact 2023-CBA salary-matching, luxury-tax, and first/second-apron validation. Fast, correct, shareable.',
  openGraph: { title: 'NBA Trade Machine', description: 'Accurate, current multi-team NBA trade simulator.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'NBA Trade Machine', description: 'Accurate, current multi-team NBA trade simulator.' },
};
```

Add inside `<footer>` (or just below it): a small provenance line — `Salaries from public data, hand-verified. Not affiliated with the NBA.`

- [ ] **Step 2: Create `app/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://nbatrademachine.app'; // real origin
  return [{ url: base, changeFrequency: 'daily', priority: 1 }];
}
```

- [ ] **Step 3: Verify** — `npm run build` succeeds; `/sitemap.xml` resolves; page source shows the new title/description/OG/Twitter tags. **Step 4: Commit**

```bash
git add app/layout.tsx app/sitemap.ts
git commit -m "feat: SEO metadata, sitemap, and data-provenance note"
```

### Task 11: Analytics + error monitoring

- [ ] **Step 1: Add Vercel Web Analytics** — `npm i @vercel/analytics`, render `<Analytics />` from `@vercel/analytics/next` in `app/layout.tsx` body. (Privacy-light, no cookie banner needed.)

- [ ] **Step 2: Add error monitoring** — install Sentry for Next.js (`npx @sentry/wizard@latest -i nextjs`) OR, to stay minimal for launch, rely on Vercel's runtime logs and defer Sentry to M3. Pick one; document the choice in the commit.

- [ ] **Step 3: Verify + commit** — deploy, confirm an analytics ping appears; trigger a test error path if Sentry was added.

```bash
git add -A
git commit -m "feat: web analytics (+ optional error monitoring) for launch"
```

---

## Phase E — QA + launch (Days 6-7)

### Task 12: End-to-end QA on real data + mobile pass

- [ ] **Step 1: Run the full suite + lint** — `npm test && npm run lint`. Expected: all green (25+ tests).

- [ ] **Step 2: Correctness QA** — build several real, known trades and confirm verdicts:
  - A clean star-for-star swap between two over-tax teams: legal.
  - A second-apron team aggregating two players: `Trade Denied: … cannot aggregate`.
  - An over-cap team taking back far too much for a small outgoing salary: `Trade Denied: … take back at most …`.
  - A first-apron (not second) team sending two players: NOT denied (no phantom block).
  Cross-check at least one verdict against a manual CBA calculation.

- [ ] **Step 3: Mobile device pass** — on a real phone (or devtools device mode): columns scroll as a carousel; cards readable; season selector + team add usable; sticky footer ad slot present; no layout shift.

- [ ] **Step 4: Fix any issues** found, committing each fix atomically with its verification.

- [ ] **Step 5: Launch checklist** — public URL live; all 30 teams rostered + accurate (audit clean); share links persist; OG images render; analytics on; suite + lint green. Tag the launch:

```bash
git tag -a v1.0.0 -m "NBA Trade Machine v1: all 30 teams, accurate CBA validation, shareable"
```

---

## Milestone 0 self-review

**PRD coverage (M0 rows of PRD §8):**
- §8.1 all-30 rosters + multi-year + options + idempotent import + audit → Tasks 1-5, 8. ✓
- §8.1 season_cap: 2025-26 only is intentional for M0 (accuracy-safe; 2026-27 projections deferred to avoid shipping wrong landmarks). Selector already derives from `season_cap`, so it offers only verified seasons. ✓ (noted, not a gap)
- §8.2 engine validated on real data + descriptive denials → Task 6, Task 12. ✓
- §8.3 build 2-4 team deals, full rosters, share page → Tasks 6, 7. ✓
- §8.4 share link + OG (built) + SEO meta + sitemap → Tasks 7, 10. ✓
- §8.5 deploy + refresh secrets + analytics + monitoring → Tasks 8, 9, 11. ✓
- §8.6 monetization → intentionally M3, not M0. ✓

**Placeholder scan:** The only `REPLACE_WITH_*` tokens are in Task 2's test, which is correct TDD practice — the test must assert against the real players/salaries in the fixture captured in Task 1 (you cannot know them before capturing). Every implementation step ships complete code. Selector confirmations (`#player-contracts`, option markers, team-id fixes) are genuine source-specific verifications with concrete defaults, not missing logic.

**Type/interface consistency:** Scraper row shape (`name, team_id, season, salary, option_type, guarantee_status, no_trade_clause, source`) is identical across `parse.py` → `normalize.py` → `contracts` schema → `data/overrides`. `parse_contracts(html)` defined in Task 2 is the exact name imported in Task 3. `localTeams`/`localRoster` used by `audit.ts` match `lib/data/local.ts`. Share page uses existing `selectValidation({season,teams,assets})` and `ValidationFeed` signatures unchanged. ✓

---

## Follow-on plans (own spec → plan → build cycle each; outlined per PRD §9)

These are NOT part of the 1-week M0. Each gets its own detailed plan when reached. All new
engine logic stays in pure, fixture-tested `lib/cba/` modules.

### Milestone 1 — Trade-eligibility + future-date projection (Phase 6)
- Populate `trade_restrictions` (recently-signed, recently-extended, base-year-comp, poison-pill).
- New pure module `lib/cba/eligibility.ts`: given a simulated date + restriction rows, returns per-asset eligibility and the date each becomes tradable.
- `validateTrade` consumes eligibility; a date picker in the UI surfaces "illegal now, legal on <date>" with the reason. Cover Dec-15 / Jan-15 and 2-month aggregation windows.
- Add 2026-27 (and beyond) `season_cap` landmarks once official, enabling true multi-season simulation.
- Exit: a fixture test per restriction kind + one worked real example.

### Milestone 2 — Cap-room depth + picks + 5-6 teams (Phase 7)
- `lib/cba/caproom.ts`: below-cap absorption using cap space + cap-hold renouncing (the Fanspo dump-trade case); TPE/exception absorption as a matching path; hard-cap trigger when an apron tool is used; minimum-salary floor; Base-Year Comp outgoing value; Stepien-rule pick checks.
- Populate `team_exceptions`, `cap_holds`, `draft_picks`.
- Draft picks as first-class routable assets with protection display; raise the team cap from 4 to 6; drag-and-drop routing.
- Exit: fixtures for each path; the Fanspo dump-trade case now validates as legal.

### Milestone 3 — Monetization + polish (Phase 5)
- Real ad network (AdSense/NitroPay) wired async/defer with a consent/CMP; 1.5s execute interstitial; share-page 300×250; full clean-UI + motion pass; per-team/per-player indexable landing pages for SEO.
- Exit: ads load async with CLS ~0; performance budget held; Lighthouse ≥ 90.
