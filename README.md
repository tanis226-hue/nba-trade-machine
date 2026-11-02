# NBA Trade Machine

A trade playground for NBA fans: build 2–7 team proposals, move players and picks, inspect cap consequences, and understand why a deal needs changes.

[Public demo](https://nbatm.zldagroup.com/) · [Release readiness](docs/RELEASE_READINESS.md)

This is a portfolio project in active development. The public deployment may lag this branch. The engine checks the inputs it receives; incomplete roster history and pick conditions limit its conclusions.

## Run a demo

Use Node 22 and npm. A database or account is not required.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. With no database variables, the app reads the bundled snapshot. See `.env.example` for optional Neon and Clerk configuration. Never copy production credentials into a demo or CI environment.

```bash
npm run verify   # lint, TypeScript, rule tests, structural data and transaction checks
npm run build   # production build; Google font downloads require network access
npm start
```

CI runs these checks without database/auth secrets. Passing them does not certify the dataset as current or establish complete CBA coverage.

## Fan workflow

1. Search for two teams and add them to the board.
2. Drag a player to the receiving team, or use the card's destination control. Add picks or cash as needed.
3. Read the blocking finding, the numerical allowance, and the cited rule. Suggestions use the validator's own shortfall; automatic fixes are offered only when the full engine verifies a nonempty resulting deal.
4. Inspect salary and estimated tax changes. Generate a link to discuss the proposal.

The board persists in the same browser. Generated links require durable database storage in production; the filesystem store is for local development.

## How it works

- **Next.js 16 / React 19 / TypeScript:** server components load rosters and picks; client components handle the board.
- **Zustand and dnd-kit:** asset routing, browser persistence, keyboard/touch interaction, and drag-and-drop.
- **Pure CBA engine (`lib/cba`):** deterministic rules return findings with severity, citations, and suggested fixes. Salary matching is separate from additive restrictions.
- **Data layer (`lib/data`):** current-season rosters, payroll, exceptions and draft rights use one immutable, versioned snapshot, atomically published to Neon with a bundled fallback. Historical data uses the archived seed.
- **Optional Clerk accounts:** disabled when unconfigured. Public exploration does not require sign-in.

## Rules and data provenance

The active roster season is 2026–27. Changing roster year starts a new board and loads that year's contract data and rules. The 2025–26 archive is a contract snapshot, with incomplete point-in-time roster counts and history. Official current-season landmarks were reconciled on November 2, 2026. Salary-matching allowances and luxury-tax bands are indexed using the 2023 CBA. Regression fixtures cover matching boundaries and the CBA's tax examples.

- [2023 CBA, NBPA](https://nbpa.com/cba): Article VII §§2(d), 6(j)(1)(iv), and 8(a).
- [Official 2026–27 cap announcement](https://www.nba.com/news/nba-salary-cap-2026-27-season).
- [NBA key dates](https://www.nba.com/news/key-dates).
- Current contracts, payroll, two-way status, exceptions and draft rights: [SalarySwish public team cap sheets](https://www.salaryswish.com/teams/celtics). Bios: public ESPN roster feeds. Historical contracts and statistical values: Basketball-Reference / NBA Stats and curated reporting.

`data/seed/roster_snapshot_2026_27.json` records the actual source retrieval time, content version and per-team source links. The UI distinguishes a successful database import from the bundled fallback. The launch snapshot contains 523 players (434 standard, 89 two-way), separate active cap hits and dead-money-inclusive team payroll, and reported future draft rights. Conflicting hard-cap labels, temporary roster exceptions and complex pick chains produce review findings. Future-year cap sheets show player contract commitments, not complete projected team payroll.

The demo baseline is versioned in `data/seed/{players,contracts}.json`, with hashes and cache timestamps in `data/seed/snapshot.json`. It was promoted from the existing June 2026 scraper cache; July overrides apply afterward. To deliberately replace that baseline after a reviewed scrape, run `npm run snapshot:build`, inspect the diff, and run `npm run verify`. This operation does not fetch data, write the database, or advance the freshness date.

The current refresh pipeline fetches ESPN biographies and throttled SalarySwish cap sheets, builds and audits a complete snapshot, then publishes it in one database write. It never replaces trades, comments or votes. A failed fetch/audit leaves the last published snapshot intact. Repository Actions needs the NBA database URL secret. To review fresh data locally:

For Actions verification, manual `refresh-data` dispatch defaults to the isolated database (`NBA_LAUNCH_DATABASE_URL`), with no fallback to production credentials. Select `production` explicitly from `main` for a production refresh; schedules on `main` use the production database secret. Each successful audit uploads the exact public snapshot as a short-lived artifact.

```bash
pip install -r scripts/scraper/requirements.txt
python scripts/rosters/pull.py
python scripts/rosters/pull_capsheets.py
npm run rosters:build
```

`out/` caches are ignored; remove the task's cache before fetching a new snapshot. Curated `txns:apply` updates the legacy overrides/feed only; it does not replace the current structured snapshot. Review data before publication:

```bash
npm run data:check                 # active season, structural checks only
npm run data:check -- 2025-26      # historical season
```

Database scripts write to the configured database and read process environment variables, not Next.js env loading. For an explicitly selected development database:

```bash
npx tsx --env-file=.env.local scripts/migrate.ts
npx tsx --env-file=.env.local scripts/rosters/publish.ts
```

Test migrations and publication on an isolated database branch first. Acquisition/Bird history, cash already used, repeater status, and conditional conveyance chains remain limits of the model; a passing modeled check is not league approval. See the readiness document for release evidence and follow-up work.
