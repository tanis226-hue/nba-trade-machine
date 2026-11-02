# Release readiness — November 2, 2026

The release supports a fan building a multi-team proposal, understanding a blocker, correcting it and sharing a versioned result without an account.

## Production launch record

Released November 2, 2026 at 14:06 EST (19:06 UTC) on [nbatm.zldagroup.com](https://nbatm.zldagroup.com/). [PR #20](https://github.com/tanis226-hue/nba-trade-machine/pull/20) shipped the release; [PR #21](https://github.com/tanis226-hue/nba-trade-machine/pull/21) repaired legacy saved-board reads and custom-domain sharing.

- Deployed application commit: `5d8dee1f26c32e2ed4594bc697020e599b5c4b23`. Netlify production deploy: `6ae8df1494638bc462d725b4`, ready with no build error. This record may be updated by later documentation-only commits.
- [Release CI](https://github.com/tanis226-hue/nba-trade-machine/actions/runs/41506747318) passed for that exact commit: 228 tests in 37 files, lint, TypeScript, structural data/transaction checks, production build and production dependency audit.
- Approved additive migrations 0010/0011 are applied. [Production refresh](https://github.com/tanis226-hue/nba-trade-machine/actions/runs/41503480755) succeeded in 1m58s, fetching both public sources, auditing all 30 teams and atomically publishing `f3ed2313191f3252`. Source retrieval: 18:45 UTC; import: 18:46 UTC. Database readback: 523 players and 449 reported draft rights. The bundled fallback remains the separately audited `cfa377fb73b4a579`.
- All three pre-existing share links still return successfully. Untouched legacy boards display “No trade verdict yet”; obsolete sign-and-trade matching metadata is opened with a review note and recalculated. New writes still require an actual multi-team move.
- [Live Boston–Dallas example](https://nbatm.zldagroup.com/trade/pa974oWnxs): Payton Pritchard for Naji Marshall. Created through Review & Share on the custom domain, reopened in a separate tab and independent HTTP request, then reopened in the editor with both routes preserved. Database readback confirms 35 assets, two moved players, rules `2026-11-02.3` and data `f3ed2313191f3252`. The saved result passes modeled checks.
- Original 3 trades, 1 comment and 1 vote were preserved; the one live example brings trades to 4. No production test comments or votes were posted. Production write-limit buckets are database-backed and do not use the local fallback identity.
- Pre-launch rollback snapshot: `approved-launch-2026-11-02` / `snap-nameless-breeze-aptz5uvb`, created 18:43 UTC, expires November 9 at 19:00 UTC. Retain the previous deployment for code rollback.

## Release changes

- Official 2026–27 cap and deadline; indexed matching, cash and tax schedules with CBA worked-example regression coverage.
- Exact correction shortfalls, a bounded automatic-fix search that returns only nonempty full-engine-valid proposals, and blocking findings when a rule fails.
- A source-dated, content-versioned snapshot: 523 players (434 standard, 89 two-way), 30 team payroll/apron baselines, current exceptions and 449 reported draft rights. Active contracts are separated from dead money. Current source: public SalarySwish cap sheets with ESPN biographies.
- Source contradictions and conditional pick chains remain visible review findings. Picks identify their original team. Stepien checks preserve additional same-year firsts and count incoming unprotected firsts.
- Changing roster year loads matching contract data and rules on a new board. Older saved boards retain their original inputs and are labeled when the dataset changes.
- JSON/schema/body limits, same-origin writes, database-backed throttling, vote deduplication, bounded comments and safe error handling. Production filesystem persistence is disabled.
- Shared results preserve server-generated rules/data/date/verdict snapshots. Review & Share only reports success after durable storage; failed saves remain retryable.
- Atomic snapshot publication with monotonic source timestamps. Fetch/build/audit failures retain the previous version; refresh does not replace trades or community data. Team detail pages read the current snapshot at request time.
- Next.js 16.4.4 and compatible dependency fixes; production audit reports zero vulnerabilities. Development ESLint dependencies retain moderate advisories; no forced incompatible downgrade was applied.

## Validation

- 228 tests across 37 files are covered by the release verification, including failed-save behavior, production/preview origin configuration, legacy saved-board reads, hosted client isolation, versioned sharing, source conflicts, active/dead salary separation, draft-rights ownership and same-year Stepien holdings. Lint, TypeScript, structural data audit and legacy transaction consistency checks pass.
- Production build passes. Clerk's required middleware convention remains, with a Next deprecation warning; Google font fallback is configured explicitly.
- Additive migrations 0010 (public-write limits) and 0011 (versioned snapshots) were tested on an isolated Neon branch. The full [GitHub refresh run](https://github.com/tanis226-hue/nba-trade-machine/actions/runs/41499558203) fetched both sources, audited and published snapshot cfa377fb73b4a579, with database readback confirming 30 teams, 523 players and 449 reported draft rights. Existing isolated counts remained 20 trades, 2 comments and 2 votes. The audited artifact is the bundled release snapshot.
- Isolated production-server smoke verified durable create/reopen, server-saved verdicts, malformed/oversized/cross-origin rejection, comment bounds, vote deduplication and database-backed throttling. Hosted preview reopens the isolated local-created slug.
- Production migration, deployment, refresh and custom-domain sharing passed after explicit launch approval. Read-only production checks cover the home/team/share/sitemap routes, missing-share 404, Open Graph image, comment/vote reads, and rejection of invalid/cross-origin writes.
- Hosted Chrome checks verify direct-link reopening in the editor, saved inputs, season reload, 390×844 routing/result access, and dialog focus/escape restoration. A production phone-sized share view has no page-level horizontal overflow. In-app browser controls were inconsistent; this is not a Safari compatibility certification. Chrome exposed proxy-origin rejection cases, now regression-tested using the preview/deployment aliases and canonical production URL captured at build time. Runtime hosted detection uses Netlify's documented SITE_ID variable so missing NETLIFY does not enable filesystem persistence or a shared local throttle bucket.

## Model boundaries

The app is a fan simulation. Passing modeled checks is not NBA approval. Contract flags and acquisition/signing/Bird history are incomplete; prior cash usage and repeater status may not be supplied. Cash proposals ask for annual-allowance review. Tax figures are estimates. Reported temporary roster exceptions, conflicting hard-cap labels and complex conditional conveyance chains require independent review. Historical 2025–26 rosters are an archived contract snapshot. Future commitments exclude dead money, cap holds, future signings and changes to options; future cap lines are not assumed.

## Operating the release

`refresh-data.yml` reads the NBA database repository secret, fetches current sources on the calendar cadence, builds and audits before writes, applies additive migrations and publishes one complete snapshot. Its clean checkout has no source caches. For local research, clear only the intended ignored roster cache before fetching again. `txns:apply`, `snapshot:build` and `seed` are legacy curation tools and do not update the current structured snapshot. Never use a full legacy import as a production freshness check.

Manual dispatch defaults to `database=isolated` and reads only `NBA_LAUNCH_DATABASE_URL`. A missing isolated secret cannot fall back to production. Production dispatch and scheduled refreshes require `main` and `DATABASE_URL` (or `NETLIFY_DATABASE_URL`). The audited public snapshot is retained as a seven-day Actions artifact so the exact published dataset can be inspected.

The isolated deploy-preview database is separate from production. Retain the prior deployment and database snapshot for rollback. A deployment can be rolled back independently; do not delete trade/community data to roll back code.

## Next portfolio milestones

1. Fan feedback on the phone flow and explanation clarity.
2. Explicit acquisition/Bird/cash/repeater inputs and independently reconciled contract restrictions.
3. Pick-chain visualization covering every conveyance outcome.
4. Fork/compare workflows and a sequence-of-moves planner.

Competitor research covered Fanspo, ESPN Trade Lab, Spotrac, SalarySwish, RealGM, Lean Edge, JJNBA and HoopsMatic. Existing competitors already offer picks, explanations, generation and exports; the portfolio should demonstrate reliability and a better fan experience through testing.
