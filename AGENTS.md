<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: NBA Trade Machine

## Commands
- Test: `npm test` (vitest). Typecheck: `npx tsc --noEmit`. Build: `npm run build`. Lint: `npm run lint`.
- DB scripts read `process.env` only — pass the env file: `npx tsx --env-file=.env.local scripts/migrate.ts` (and `scripts/import.ts`). `npm run migrate` / `npm run seed` alone will fail with "Set DATABASE_URL".
- Stats refresh (residential IP only — stats.nba.com blocks cloud IPs): `npx tsx scripts/stats/pull.ts`.

## Gotchas (things that have bitten us)
- **The app runs against the live Neon DB** (`DATABASE_URL` in `.env.local`). `hasDb()` true → queries hit Neon; otherwise the filesystem fallback (`lib/data/local.ts`) reads `data/seed` < `scripts/scraper/out` < `data/overrides`. New queries must degrade gracefully (try/catch → local) so a not-yet-migrated column never 500s the page.
- **Migrations**: `scripts/migrate.ts` is tracked + idempotent (`schema_migrations`). Migration SQL must avoid `;` inside comments and reserved keywords as column names (e.g. `window` → use `news_window`). Additive only (`add column if not exists`).
- **Base season is `2026-27`** (`SEASON_2026_27` in `lib/cba/constants.ts`, store default, `selectValidation`). 2025-26 stays as a prior year. Projected 26-27 cap landmarks are marked `// PROJECTED` — verify when official.
- **CBA engine** is pure + fixture-tested under `lib/cba/`. Rules are `(ctx: RuleContext) => TradeFinding[]` registered in `lib/cba/rules/index.ts`. Only `matchingRule` may *legalize* a takeback (cap-room/TPE/min/non-sim); the rest are additive. Ignore Stay assets (`fromTeam===toTeam`) everywhere.
- After UI changes, verify in the browser (preview MCP). React state updates are async — click in one eval, read the DOM in the next.

## Data sources
- Salaries/options: Basketball-Reference scrape (`scripts/scraper`). Player value (Game Score) + bio + headshots (nba_id) + **age** (leaguedashplayerbiostats, joined by person id) + **2026 rookies**: `stats.nba.com` (`scripts/stats/pull.ts`, residential IP only). Rookies inject into `data/overrides/{players,contracts}.json` at rookie-scale.
- **Roster moves / pending trades**: curate into `data/overrides/players.json` (override row replaces the scraped row by `id`; set the new `team_id`). Then bump `DATA_AS_OF` + prepend the deal to `RECENT_TRANSACTIONS` in `lib/data/freshness.ts` (mark `reflected:true` only once the players are actually moved). The live Neon app shows the move after `npm run seed`; the local fallback reflects it immediately. The Giannis→Heat deal (Jun 23 2026) is curated; its pick-ownership leg (`draft_picks.json`) is still pending.
- **Draft picks are REAL** future ownership (drafts 2027-2033) as of Jun 2026, web-researched (ESPN/Fanspo/reporting) into `scripts/picks/_raw.json` → `scripts/picks/build.ts` → `data/seed/draft_picks.json`. `draft_picks` is full-replace: `import.ts` runs `DELETE FROM draft_picks` before re-loading. Protection wording is approximate; refresh by re-running the pick-research workflow + build.
- Still needed (behind Cloudflare 403 — Spotrac/RealGM): trade kickers, NTCs, TPE balances, signed-via/Bird. Schema + override layer ready; needs a proxy or the Spotrac API.
