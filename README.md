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
- **Data layer (`lib/data`):** Neon Postgres when configured, otherwise filesystem data. Merge precedence is `data/seed` → `scripts/scraper/out` → `data/overrides`.
- **Optional Clerk accounts:** disabled when unconfigured. Public exploration does not require sign-in.

## Rules and data provenance

The active roster season is 2026–27. The cap-year selector changes rule tables, not the loaded roster salaries; historical roster simulation is incomplete. Official current-season landmarks were reconciled on November 2, 2026. Salary-matching allowances and luxury-tax bands are indexed using the 2023 CBA. Regression fixtures cover matching boundaries and the CBA's tax examples.

- [2023 CBA, NBPA](https://nbpa.com/cba): Article VII §§2(d), 6(j)(1)(iv), and 8(a).
- [Official 2026–27 cap announcement](https://www.nba.com/news/nba-salary-cap-2026-27-season).
- [NBA key dates](https://www.nba.com/news/key-dates).
- Contracts: Basketball-Reference scraper plus curated overrides. Stats/bios: NBA Stats. Pick ownership and restrictions: manually researched public reporting; some protections are approximate.

The bundled roster snapshot is dated in `lib/data/freshness.ts`. It is **not** a verified live-database sync timestamp. Future-year cap sheets are projections.

The demo baseline is versioned in `data/seed/{players,contracts}.json`, with hashes and cache timestamps in `data/seed/snapshot.json`. It was promoted from the existing June 2026 scraper cache; July overrides apply afterward. To deliberately replace that baseline after a reviewed scrape, run `npm run snapshot:build`, inspect the diff, and run `npm run verify`. This operation does not fetch data, write the database, or advance the freshness date.

Roster updates use `scripts/txns/pending.json`, `npm run txns:apply`, and `npm run txns:check`. See `scripts/txns/README.md`. Review merged data before import:

```bash
npm run data:check                 # active season, structural checks only
npm run data:check -- 2025-26      # historical season
```

Database scripts write to the configured database and read process environment variables, not Next.js env loading. For an explicitly selected development database:

```bash
npx tsx --env-file=.env.local scripts/migrate.ts
npx tsx --env-file=.env.local scripts/import.ts
```

Do not run these against production as a verification step. See the readiness document for current blockers and the next fan-focused milestones.
