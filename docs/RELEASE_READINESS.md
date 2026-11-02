# Release readiness — November 2, 2026

The release supports a fan building a multi-team proposal, understanding a blocker, correcting it and sharing a versioned result without an account.

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

- 222 tests across 36 files are covered by the release verification, including failed-save behavior, proxy-origin validation, hosted client isolation, versioned sharing, source conflicts, active/dead salary separation, draft-rights ownership and same-year Stepien holdings. Lint, TypeScript, structural data audit and legacy transaction consistency checks pass.
- Production build passes. Clerk's required middleware convention remains, with a Next deprecation warning; Google font fallback is configured explicitly.
- Additive migrations 0010 (public-write limits) and 0011 (versioned snapshots) were tested on an isolated Neon branch. Snapshot publication/readback verified all 30 teams and version e64dc987bd5b0f72.
- Isolated production-server smoke verified durable create/reopen, server-saved verdicts, malformed/oversized/cross-origin rejection, comment bounds, vote deduplication and database-backed throttling. Hosted preview reopens the isolated local-created slug.
- Source and production preview verification, scheduled-refresh proof and final browser checks are release gates; record their actual outcomes in the launch report. Do not infer live readiness from a local test result.
- Hosted Chrome checks verify direct-link reopening in the editor, saved inputs, season reload, 390×844 routing/result access, and dialog focus/escape restoration. In-app browser controls were inconsistent; this is not a Safari compatibility certification. Chrome exposed a proxy-origin rejection, now regression-tested using public deployment URLs captured at build time. Runtime hosted detection uses Netlify's documented SITE_ID variable so missing NETLIFY does not enable filesystem persistence or a shared local throttle bucket.

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
