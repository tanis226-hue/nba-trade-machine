# Daily data-refresh routine prompt

Hand the block below to Claude Code as a scheduled routine (`/schedule`) or run it manually.
Cadence: **daily during the offseason** (late June - September), **weekly in-season**.

---

You are maintaining the data for the NBA Trade Machine at
`c:\Users\tanis\Documents\GitHub\ZLDA Labs\nba-trade-machine`. Keep the rosters and the
freshness feed current. Work on a branch, not `main`.

1. **Find the window.** Read `DATA_AS_OF` in `lib/data/freshness.ts`. That is the last date we
   curated; today is the end of the window.

2. **Research** every transaction that CHANGED A PLAYER'S TEAM in that window (trades,
   sign-and-trades, and free-agent signings to a NEW team), plus notable re-signings/extensions.
   Cross-check at least two of: ESPN, NBA.com, Yahoo, Hoops Rumors, Spotrac, and the Wikipedia
   "List of 2026-27 NBA season transactions" page. For a busy window, spawn a research subagent.

3. **Author `scripts/txns/pending.json`** per the schema in `scripts/txns/README.md`. Rules:
   - Reflect straight trades (`reflect` omitted) - players already under contract.
   - Free-agent signings and sign-and-trades: `"reflect": false` (their new salary isn't in our
     data yet; the scrape backfills it). Group role-player signings into one "free-agency wave" deal.
   - Deals reported "on hold" / pending league approval: `status:"pending"`, `reflected:false`,
     empty `moves`.
   - Never invent salary numbers. No em-dashes in summaries.

4. **Apply + verify.** Run in order, fixing issues between steps:
   - `npm run txns:apply` - fix any UNRESOLVED player names in `pending.json` and re-run until clean.
   - `npm run txns:check` - must print "OK - safe to seed".
   - `npx tsc --noEmit` - must exit 0.

5. **Backfill structured data IF this environment allows it** (residential IP; skip on a cloud
   runner and note it in the summary - it will catch up on the next local run):
   - Basketball-Reference scrape (`scripts/scraper`) for new salaries/options.
   - `npx tsx scripts/stats/pull.ts` for value/age/YOS/2026 rookies (stats.nba.com blocks cloud IPs).
   - Re-run `npm run txns:check` afterward; players that were PENDING should now render.

6. **Publish.** `npm run seed` writes to the live Neon DB (safe from any IP).
   *(Delete this step if you want to review the diff and seed manually before it hits the live app.)*

7. **Commit** the changed data files (`data/`, `lib/data/freshness.ts`, `scripts/txns/pending.json`)
   with a message like `data: refresh trades/FA through <today>`, and report a summary: deals added,
   players moved, items still PENDING (awaiting contract data), and any names you could not resolve.

Do not touch the CBA engine, UI, or migrations. Data files only.
