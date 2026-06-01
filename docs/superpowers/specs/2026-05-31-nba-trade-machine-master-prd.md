# NBA Trade Machine — Master PRD

**Date:** 2026-05-31
**Status:** Draft for review
**Owner:** David Tanis (ZLDA)
**Supersedes scope of:** `2026-05-31-nba-trade-machine-design.md` (v1 design) and
`2026-05-31-nba-trade-machine-v1.md` (v1 build plan). Those remain the authoritative
detail for Phases 0-4 already built; this document is the product-level source of truth
for the *whole* product and the plan to finish it.

---

## 1. One-line product

The fastest, most *correct and current* multi-team NBA trade simulator: real contracts for
all 30 teams, exact 2023-CBA apron/luxury-tax validation, and clean share links - where
"we are right when the others are wrong" is the entire pitch.

## 2. Locked product decisions (from owner, 2026-05-31)

| Question | Decision | Consequence |
|---|---|---|
| Scope ceiling | **Finish the specced product** (Phases 5-7). No platform features (accounts, feed, AI), no multi-sport. | Roadmap ends at a polished, accurate, ad-supported NBA tool. |
| North star | **Accuracy/currency is the moat.** Correctness and data freshness beat growth features. | When trading off, spend on data + CBA completeness + verification, not on bells. |
| Data sourcing | **Recommended here** (see §7): scrape Basketball-Reference as primary, override layer authoritative, HoopsHype cross-check, paid API as fallback. | Day-1 spike confirms; the override layer is the correctness backstop. |
| Timeline | **~1 week to fully functional for all 30 teams, deployed.** | Milestone 0 (§9) is a data + deploy sprint. Phases 6/7/5 are fast-follow, not in the 1-week window. |

**Interpretation of the deadline (call this out for confirmation):** "fully built out and
functional for all 30 teams next week" = Milestone 0 below: every team has a complete,
accurate, current roster with multi-year contracts; the existing engine/UI/share work
end-to-end against that data; the app is deployed to a public URL. "Finish the specced
product" (Phases 5-7) extends a few weeks past that as fast-follow milestones. If the intent
is *all of 5-7* live in 7 days, that is not credible at a quality bar where accuracy is the
moat; M0 is the honest 1-week target.

## 3. Users and the job they hire us for

- **NBA power fans / "NBA Twitter" / Reddit r/nba** building and arguing trades. They will
  screenshot and link deals. They punish wrong salary-matching and phantom apron flags
  instantly, which is exactly where Fanspo/Spotrac lose credibility - and our wedge.
- **Fantasy/dynasty and capologist hobbyists** who want the year-by-year contract, options,
  and guarantees visible on one screen.
- **Secondary:** content creators who need a clean, accurate share image for posts.

Primary job-to-be-done: *"Let me build a realistic multi-team deal and instantly trust
whether it is actually legal under the current CBA, then share it."*

## 4. Success metrics (accuracy-first)

| Tier | Metric | Target |
|---|---|---|
| Moat (primary) | Contract-accuracy vs. Spotrac/HoopsHype spot audit | ≥ 99% of current-season salaries correct; 100% on top-100 salaries |
| Moat | Data currency | New extensions/signings reflected within 24h via override layer |
| Moat | CBA-correctness regression suite | 100% green; every shipped rule has a fixture test |
| Coverage | Teams fully rostered | 30 / 30 |
| Engagement | Share links generated / week | Trend up post-launch (no hard target v1) |
| Performance | Validation recompute on asset move | < 50ms client-side; no network |
| Quality | Cumulative Layout Shift | ~0 (ad slots reserved) |

## 5. Current state inventory (what is actually built, 2026-05-31)

Verified by reading the tree and running the suite (`npm test` → **8 files, 25 tests pass**).

**Done and working:**
- **CBA engine** (`lib/cba/`): `tier`, `matching` (3-tier + 100% apron), `apron`,
  `validateTrade`, `constants` (2025-26). Pure, dependency-free, fixture-tested.
- **Trade store** (`lib/store/`): Zustand store (season + 4-team cap + asset routing) and a
  season-aware `selectValidation` selector. Tested.
- **Data layer** (`lib/data/`): typed Supabase queries (`getTeams/getRoster/getSeasons/
  getSeasonCap`, `saveTrade/getTrade`) and a **filesystem fallback** (`local.ts`) so the app
  runs with no DB. Merge precedence seed < scraper-out < override.
- **UI** (`components/`): `TradeBoard`, `TradeMatrix`, `TeamColumn`, `TeamCapPanel`
  (cap meters + tier badge), data-rich `PlayerCard` (year-by-year contract, option, NTC),
  `ValidationFeed`, `SeasonSelector`, `ExecuteTradeButton`, `GenerateLinkButton`, `AdSlot`.
  A design pass exists (custom theme tokens, display font, hero).
- **Sharing**: `POST /api/trade` → slug → read-only `/trade/[slug]` page + multi-team
  `opengraph-image` (no truncation).
- **Schema**: `supabase/migrations/0001_init.sql` - 10 tables incl. contract detail,
  `trade_restrictions`, `team_exceptions`, `cap_holds`, `draft_picks`, `trades`.
- **Pipeline scaffolding**: `scripts/import.ts` (merge + upsert), `data/overrides/*`,
  refresh GitHub Action.

**The gap in one number:** rosters exist for **2 of 30 teams** (17 players, ~20 contract
rows). `season_cap` has **1 season** (2025-26). The product is a correct, attractive,
*empty* machine.

## 6. Gap analysis - everything missing, by area

Ordered by what blocks the 1-week "functional for all 30 teams" goal.

### 6.1 Data (CRITICAL PATH - this is 70% of the week-1 work)
- **No real rosters for 28 teams.** Need ~450-540 players with current-season salary plus
  future contract years and option/guarantee flags. This is the single thing standing
  between "demo" and "product."
- **Scraper is a TDD'd shell with placeholder selectors and no chosen source.** `parse.py`
  was specced against a fixture but the source + selectors are not committed.
- **No future-season cap landmarks.** `season_cap` only has 2025-26, so the season selector
  cannot simulate 2026-27/2027-28 even though contracts carry future years.
- **No verification harness.** Accuracy is the moat but nothing audits scraped salaries
  against a second source.
- **Draft picks, TPEs, cap holds, trade restrictions tables are empty** (needed for Phase
  6/7, not for M0).

### 6.2 CBA engine completeness (deferred past M0, but in scope per "finish the product")
- Trade-eligibility dates and **future-date projection** ("illegal now, legal on <date>"):
  recently-signed (no-trade window), recently-extended (6-month / poison-pill), Dec-15 /
  Jan-15 rules, 2-month aggregation windows. Tables exist; engine logic does not.
- **Base-Year Compensation** outgoing-value handling.
- **Cap-room path**: below-cap teams absorbing salary into space + **cap-hold renouncing**
  (the Fanspo dump-trade failure).
- **TPE / exception absorption** as a matching path.
- **Hard-cap trigger modeling** when an apron tool is actually used (the spec promises "no
  phantom flags"; the inverse - applying a hard cap when a tool *is* used - is not modeled).
- **Stepien rule** / pick-protection legality on pick trades.
- **Minimum team salary** floor is in constants but unused.

### 6.3 UI / UX
- **Asset selection for incoming players** is thin (incoming shown as a label chip; routing
  is a per-card `select`). Picks are not yet first-class in the UI.
- **Draft-pick assets**: no UI to add/route picks (data model supports them).
- **Mobile carousel** polish and sticky-footer behavior need a real device pass.
- **Roster realism**: a team's full roster should load (not just a seed subset), with search
  and "add player to deal" UX as rosters grow to 15+ per team.
- **Empty/error/loading states**, 404 for bad slugs (partly there via `notFound`).
- **Trade summary / "who gets what"** human-readable recap on the build page (exists on share
  page only).

### 6.4 Sharing, SEO, growth (matters even with accuracy-first, it is how power users find us)
- **No SEO surface**: no per-team or per-player landing pages, no metadata/sitemap, no
  structured titles. For an accuracy-moat product, ranking on "<player> trade" queries is the
  cheap distribution.
- Share page is functional but minimal (abbr + "Receives:"); should show salaries, the
  validation verdict, and richer team cards.
- Copy-to-clipboard, social meta tags (Twitter card) beyond the OG image.

### 6.5 Infrastructure / deploy / ops (blocks the "deployed" half of M0)
- **No deployment.** Need a Vercel project + a Supabase project (or commit to the
  no-DB/local mode for launch). Env vars, service-role key, CI secrets unset.
- **Data refresh** GitHub Action references secrets that do not exist yet.
- **No analytics** (privacy-light, e.g. Plausible/Vercel Analytics) to see traffic/shares.
- **No error monitoring** (Sentry or equivalent) for the live app.

### 6.6 Correctness, QA, legal
- **No end-to-end / accuracy test** beyond unit tests.
- **Scraper ToS** for the chosen source is unconfirmed (§7 handles this).
- **No "data provenance" note** on the site (which is itself a trust/credibility asset for an
  accuracy-first product: "salaries via X, corrections by us").

### 6.7 Monetization (Phase 5, intentionally last given accuracy-first)
- Ad **slots** exist (CLS-safe placeholders); **no ad network** wired, no consent/CMP, no
  1.5s execute interstitial.

## 7. Data sourcing decision (the #1 blocker) - RECOMMENDATION

**Recommended primary: scrape Basketball-Reference `/contracts/players.html`.**
Rationale: it is a *single page* listing every NBA player with **year-by-year salary across
all contract seasons** and **option annotations** (player option, team option, early
termination, two-way, non-guaranteed). That is almost exactly our `contracts` schema in one
fetch, so a single parser covers all 30 teams and future years - the fastest path to full
coverage in a week. Team mapping comes from the same table.

**Correctness stack around it (this is the moat):**
1. **Override layer is authoritative.** Any `source:"override"` row wins the merge. New
   extensions/signings and any scrape error are corrected here within 24h.
2. **Cross-check pass vs. HoopsHype** for the top ~100 salaries and all playoff-contender
   rosters before launch; discrepancies become override rows. SalarySwish is a third tie-breaker.
3. **Provenance on the site**: "Salaries sourced from public data and hand-verified by us"
   - turns the method into a trust signal.

**Fallback if scraping is blocked or too fragile:** a paid sports-data API
(e.g. sportsdata.io NBA, which exposes salary/contract endpoints) on a low monthly tier.
More robust and ToS-clean; costs money and adds an integration day.

**ToS / etiquette:** Sports Reference permits limited personal use and rate-limits
(~1 request / 3s); we fetch *one page* weekly plus manual refreshes, throttled and cached,
no bulk redistribution. Confirm current terms during the Day-1 spike; if terms or blocking
make it untenable, switch to the paid API fallback the same day.

**Day-1 decision gate (time-boxed to a few hours):** capture the live page, confirm the
table structure and option markers parse cleanly, confirm ToS is acceptable. Pass → build on
Basketball-Reference. Fail → paid API fallback. Either way the override layer and the import
merge are unchanged, so downstream work is not blocked by the choice.

## 8. Requirements (whole product)

Functional requirements grouped by area. Each is a shippable, testable unit. **[M0]** = in
the 1-week window; **[F]** = fast-follow (Phases 5-7).

### 8.1 Data
- **[M0]** All 30 teams have complete current rosters with year-by-year contracts, option
  type, and guarantee status, sourced per §7.
- **[M0]** `season_cap` holds 2025-26 and at least projected 2026-27 landmarks (or the season
  selector is constrained to seasons with landmarks).
- **[M0]** Import is idempotent and re-runnable; override rows always win.
- **[M0]** Accuracy audit script flags salary deltas vs. a second source for manual review.
- **[F]** `draft_picks`, `team_exceptions` (TPE/MLE), `cap_holds`, `trade_restrictions`
  populated for the teams/cases Phases 6-7 need.

### 8.2 CBA engine
- **[M0]** Current engine (matching 3-tier, 100% apron, second-apron aggregation block, no
  phantom hard cap) validated against real all-30 data; descriptive denials.
- **[F]** Trade-eligibility dates + future-date projection with reasons.
- **[F]** Cap-room absorption + cap-hold renounce; TPE/exception absorption; hard-cap trigger
  when an apron tool is used; Base-Year Comp; Stepien pick-legality; minimum-salary floor.

### 8.3 Frontend
- **[M0]** Build a 2-4 team deal from real rosters; live validation < 50ms; cap meters,
  tier badges, year-by-year contract on cards; descriptive `Trade Denied:` feed.
- **[M0]** Full team rosters load with an "add player to this side" interaction that scales to
  15+ players per team (search/filter if needed).
- **[M0]** Read-only share page shows all teams, salaries, who-gets-what, and the verdict.
- **[F]** Draft picks as first-class routable assets + protection display.
- **[F]** Mobile carousel polish; 5-6 team support; drag-and-drop.

### 8.4 Sharing / SEO
- **[M0]** Generate link → persistent slug → share page + multi-team OG image (built).
- **[M0]** Basic SEO: titles, description, sitemap, Open Graph/Twitter meta.
- **[F]** Per-team and per-player indexable landing pages targeting trade queries.

### 8.5 Infra / ops
- **[M0]** Deployed to a public URL (Vercel). Decide DB-backed (Supabase project) vs. launch
  on the committed local data set; either is acceptable for M0 as long as share links persist.
- **[M0]** Scheduled refresh runs against real secrets, or a documented manual refresh.
- **[M0]** Privacy-light analytics + error monitoring on.

### 8.6 Monetization
- **[F]** Real ad network wired (async/defer, CMP/consent), execute interstitial, share-page
  rectangle. Slots already reserved and CLS-safe.

## 9. Roadmap

Milestones are gated: do not start the next until the prior's acceptance criteria pass.

### Milestone 0 - "Functional for all 30 teams, deployed" (THIS WEEK)
The 1-week forcing function. Overwhelmingly data + deploy.

| Day | Work | Exit |
|---|---|---|
| 1 | Data-source spike (§7 gate). Capture fixture, finalize parser selectors, confirm ToS. | Source chosen; `parse.py` extracts real rows from the live page. |
| 2 | Full scrape + normalize all 30 teams + future contract years; populate `season_cap` for 2025-26 (+ 2026-27 projection). | `import`/local data has 30 rostered teams. |
| 3 | Accuracy audit pass vs. HoopsHype on top-100 + contenders; corrections into override layer; site provenance note. | ≥ 99% spot-audit accuracy; 100% on top-100. |
| 4 | Wire real rosters end-to-end: full-roster load + "add player" UX; verify engine on real numbers; richer share page. | Build a real 3-team deal, get correct verdict, share renders all teams. |
| 5 | Deploy: Vercel (+ Supabase or committed local data); env/secrets; analytics + error monitoring; SEO meta + sitemap. | Public URL live; share links persist; no console errors; CLS ~0. |
| 6-7 | QA on real data + mobile device pass; fix; buffer. | Ship-ready: suite green, manual QA checklist passed. |

**M0 acceptance:** every team rosters correctly; a multi-team deal validates correctly on
real salaries with descriptive denials; share link + OG image render all teams; app is on a
public URL with analytics/monitoring; accuracy audit logged.

### Milestone 1 - Trade-eligibility + future-date projection (Phase 6, fast-follow)
Populate `trade_restrictions`; engine consumes eligibility dates; date-picker projection
surfaces "illegal now, legal on <date>" with the reason. Directly attacks Spotrac's "no
future planning" gap. Exit: fixture tests for each restriction kind + a worked real example.

### Milestone 2 - Cap-room depth + picks + 5-6 teams (Phase 7, fast-follow)
Below-cap absorption + cap-hold renounce; TPE/exception absorption; hard-cap trigger
modeling; draft picks as routable assets with protection UI; 5-6 team trades; Stepien/Base-
Year checks. Exit: fixtures for each path + the Fanspo dump-trade case now passes.

### Milestone 3 - Monetization + polish (Phase 5, last by design)
Ad network + consent, execute interstitial, share rectangle, drag-and-drop, full clean-UI
pass. Exit: ads load async with zero CLS; Lighthouse/perf budget held.

## 10. Architecture deltas from current

No rewrites; the v1 architecture holds. Net new/changed:
- **Scraper**: commit a concrete `parse.py` for the chosen source (one page, all teams,
  multi-year columns, option markers) + `normalize.py` writing `out/players.json` and
  `out/contracts.json`.
- **Accuracy audit**: a small script that diffs scraped salaries vs. a second source and
  prints a review list.
- **season_cap**: add future-year landmark rows; `BY_SEASON` map in `selectValidation`
  extended accordingly.
- **Engine**: new pure modules under `lib/cba/` for eligibility/projection (M1) and
  cap-room/TPE/hard-cap (M2), same dependency-free, fixture-tested pattern.
- **SEO**: metadata + sitemap route; later, generated team/player pages.
- **Deploy**: Vercel config + Supabase project (or documented local-data launch) + secrets.

## 11. Non-functional requirements
- Validation is client-side and effectively instant (< 50ms recompute, no network).
- Accuracy is the release gate: an inaccurate salary is a P0 bug, not cosmetic.
- Ad scripts async/defer; all ad containers keep reserved `min-height`; CLS ~0.
- Mobile-first; column carousel on small screens; sticky footer preserved.
- Data freshness: scheduled refresh + same-day override corrections.
- The CBA engine stays pure and portable (browser + server + tests, unchanged).

## 12. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Scrape source blocks us or changes layout | Blocks the whole week-1 goal | Day-1 ToS/parse gate; paid-API fallback ready same day; override layer survives either way |
| Option/guarantee parsing is wrong | Accuracy moat undermined | Cross-source audit pass; option markers explicitly tested; provenance + override correction loop |
| 1-week scope is data-heavy and slips | Miss offseason traffic | M0 is deliberately just data + deploy; Phases 5-7 are out of the 1-week window |
| Future-year cap landmarks are projections | Season selector could mislead | Constrain selector to seasons with real/credible landmarks; label projected years |
| No DB at launch (local mode) | Share links / refresh limited | Acceptable for M0 if links persist; Supabase is a one-day add when needed |

## 13. Open decisions (for owner)
1. **Deadline interpretation** (§2): confirm M0 (all-30 functional + deployed) is the 1-week
   target, with 5-7 as fast-follow - vs. expecting 5-7 live in 7 days.
2. **DB at launch**: Supabase project now, or launch on committed local data and add Supabase
   later? (M0 works either way.)
3. **Data-source final call** is the Day-1 spike, but flag any preference now (e.g. avoid
   scraping entirely → go straight to paid API).

## 14. Out of scope (whole product)
User accounts/auth, social feed, AI trade suggestions, multi-sport, real-money features,
native apps. (Per §2 scope decision.)

## 15. Sources
- 2025-26 cap figures and salary-matching/apron rules: see v1 design spec §11 (carried
  forward, already encoded in `constants.ts`).
- Candidate data sources evaluated 2026-05-31:
  [Basketball-Reference player contracts](https://www.basketball-reference.com/contracts/players.html),
  [HoopsHype salaries](https://www.hoopshype.com/salaries/players/),
  [SalarySwish](https://www.salaryswish.com/browse),
  [Spotrac](https://www.spotrac.com/nba) (competitor / cross-check only).
