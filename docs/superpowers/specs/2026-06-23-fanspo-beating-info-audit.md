# NBA Trade Machine — Information Requirements Audit (vs Fanspo)

**Date:** 2026-06-23  
**Method:** 8-agent research workflow (Fanspo/ESPN/Spotrac/SalarySwish/RealGM teardown, full 2023-CBA data model, per-field source plan, adversarial completeness critique).  
**Companion plan:** `~/.claude/plans/radiant-inventing-zebra.md` (Master Plan: Beat Fanspo).  
**Scale:** 118 distinct fields enumerated. Critic verdict: `major_gaps` (gaps patched in the addendum below).

---

# Information Requirements Audit — NBA Multi-Team Trade Machine (vs Fanspo)

**Synthesis of five research reports + direct source-grounding of the live schema/engine.** Goal: to build a machine that is *more accurate, more current, and deeper* than Fanspo, enumerate exactly what information is required, where each field comes from, and what is missing today.

**Grounding facts confirmed by reading source (not assumed):**
- Schema = `supabase/migrations/0001_init.sql` (10 tables; 4 empty: `draft_picks`, `team_exceptions`, `cap_holds`, `trade_restrictions`).
- Engine = `lib/cba/validateTrade.ts` enforces exactly **2 rules**: second-apron aggregation block (`playersOut >= 2 && !canAggregate`) and over-match (`incoming > maxIncomingSalary`). Picks ignored (`salary: 0`).
- `lib/cba/constants.ts` hardcodes 2025-26 cap/matching/apron; **two sources of truth** for cap numbers (SQL `season_cap` AND `SEASON_2025_26`) → drift risk.
- **Schema bug A:** `contracts.option_type` is overloaded — holds both option type (`team|player|eto|guaranteed`) AND structural flags (`non_guaranteed|two_way`). These are orthogonal and must be split.
- **Schema bug B:** SQL `season_cap` has `min_team_salary`, but the TS `SeasonCap` interface (`lib/cba/types.ts`) **omits it** — engine cannot read the floor.
- **Data bug C:** the scrape leaves `players.position`, `players.age`, `players.years_of_service` = `null` (per Report E reading `scripts/scraper/out/*.json`). YOS is present in schema but unpopulated and unused.

Priority legend: **P0** = required for correct CBA validation · **P1** = Fanspo parity · **P2** = superiority/differentiator.
Status legend: ✅ HAVE · 🟡 PARTIAL (exists but underspecified/overloaded/unpopulated) · ❌ MISSING.

---

## SECTION 1 — COMPLETE DATA MODEL

### 1.1 CONTRACT (richest entity; current `contracts` is the weakest link)

| Field | Pri | Rule / feature it serves | Primary source | Status |
|---|---|---|---|---|
| `player_id` | P0 | links contract→player | BBRef scrape | ✅ |
| `season` | P0 | per-year cap hit; multi-year matching; eligibility | BBRef scrape | ✅ |
| `salary` (cap hit, per year) | P0 | salary matching, team salary, tax, apron | BBRef scrape | ✅ (only number engine reads) |
| **`cap_hit` vs `paid_salary` split** | P0 | BYC outgoing≠incoming; likely-incentives in cap hit; tax on cap salary | Spotrac + manual | 🟡 one `salary` conflates both |
| `option_type` enum (team/player/eto/none) | P0 | option years count for matching unless declined | BBRef scrape | 🟡 **overloaded** with two_way/non_gtd — must split |
| **option decision date** | P1 | is a future option year "on the books"/tradeable? | manual + Spotrac | ❌ |
| `guarantee_status` (full/partial/non) | P0 | non/partial still counts at FULL for matching; dead money on cut | BBRef flag | 🟡 see next rows |
| `partial_guarantee_amount` ($) | P0 | dead-money/stretch base; set-off | **Spotrac (prose) + manual** | ✅ field exists, ❌ no clean source (BBRef = flag only) |
| **guarantee date** (partial→full) | P1 | Jan 7/10 guarantee dates; "real" salary as of trade date | Spotrac + manual | ❌ |
| `no_trade_clause` (bool) | P0 | NTC consent; blocks some aggregation | Hoops Rumors (tiny set: LeBron) | ✅ (hard-code) |
| **implied/1-yr NTC** (1-yr Bird re-sign / 1-yr+PO) | P1 | de-facto consent right | derived (YOS+signing) | ❌ |
| **`trade_bonus_pct`** (kicker, ≤15%) | P0 | adds to *incoming* salary for matching; auto-reduces at max | **Hoops Rumors kicker list (name+%)** | ❌ |
| **trade bonus remaining $ / max-cap flag** | P0 | kicker is % of remaining base excl. option years; voids at max | computed | ❌ |
| **likely incentives ($)** | P0 | count in cap hit AND matching salary | Spotrac bonuses | ❌ |
| **unlikely incentives ($)** | P1 | excluded from cap, but count for apron/hard-cap tests; ≤15% base | Spotrac + manual | ❌ |
| **`signed_via` / exception used** (Bird/Early/Non/NTMLE/TaxMLE/RoomMLE/BAE/Min/Room/RookieScale/S&T) | P0 | gates BYC, S&T legality, hard-cap triggers, re-sign matching | **manual curation (no public structured source)** | ❌ critical, everything cascades from it |
| **`bird_rights`** (bird/early/non) | P0 | re-sign exception; BYC trigger; S&T | derived/manual | ❌ |
| **BYC status + computed outgoing value** | P0 | S&T of Bird FA >20% raise at/over cap → out = greater(50% salary, prior salary); asymmetric match | computed | 🟡 `trade_restrictions.kind='base_year_comp'` flag only; no dual value |
| **poison-pill (extended rookie) dual value** | P0 | out = avg(remaining old+new); in = next-year salary | computed | 🟡 `kind='poison_pill'` flag only; no dual value |
| **`is_two_way`** (bool) | P0 | excluded from team salary; not tradeable (convert first); 3-slot max | BBRef flag | 🟡 buried in overloaded `option_type` |
| **Exhibit 10 (bool)+bonus $** | P2 | camp/min; not tradeable; converts to two-way | manual | ❌ |
| **Exhibit 9 / 10-day (bool)** | P2 | injury clause / 10-day not tradeable | manual | ❌ |
| **start & end season / term** | P1 | Stepien-adjacent future commitments; option years | derived from rows | 🟡 implicit only |
| **annual raise %** (5/8%) | P2 | validate extension/new-deal construction | computed | ❌ |
| **dead money / stretch schedule** | P1 | waived gtd spread over (2×yrs)+1 | computed | ❌ |
| **set-off rights/amount** | P2 | reduces dead money if signs elsewhere | computed | ❌ |
| **`signed_date`** | P0 | 3-mo/Dec 15/Jan 15 eligibility | BBRef transactions / Spotrac | 🟡 `trade_restrictions.eligible_date` exists but manual, not derived |
| **`acquired_date`** | P0 | 2-month aggregation lock on traded-in player | derived from trade events | 🟡 `cannot_aggregate_until` exists but unpopulated |
| **extension/renegotiation date** | P1 | 6-month trade freeze | manual + Spotrac | ❌ |
| **`is_rookie_scale_extension`** (bool) | P0 | poison-pill detection | manual | ❌ |
| `source` (scrape/override) | P0 | provenance/manual correction | internal | ✅ |

### 1.2 PLAYER

| Field | Pri | Rule / feature | Source | Status |
|---|---|---|---|---|
| `id`, `name`, `team_id` | P0 | identity / books | BBRef | ✅ |
| `position` | P1 | fit analysis, display | BBRef/nba_api | 🟡 **null in scrape** |
| `age` | P1 | value/age-curve grading | BBRef | 🟡 **null in scrape** |
| `years_of_service` | P0 | min-salary scale; vet-min reimbursement; Bird tiers; 10+ max | BBRef | 🟡 in schema, **null in scrape**, unused |
| **RFA/UFA status + qualifying offer $** | P1 | S&T legality; offer sheets; RFA cap hold | manual/Spotrac | ❌ |
| **draft year / draft team / draft slot** | P1 | rookie-scale option years; pick lineage; rookie-ext | BBRef | ❌ |
| **injury status / games missed** | P2 | injury-aware value discount | balldontlie ($9.99)/nba_api/injury report | ❌ |

### 1.3 TEAM

| Field | Pri | Rule / feature | Source | Status |
|---|---|---|---|---|
| `id,name,abbr,conference,colors,logo` | P0/P1 | identity/display | seed | ✅ |
| **team salary (computed)** | P0 | base for tax/apron/matching (contracts + holds + exceptions + min-roster charges; two-ways excluded; unlikely bonuses incl. for apron only) | derived | 🟡 engine takes opaque `preTradeSalary`; nothing computes it |
| **cap space (computed)** | P0 | room teams use cap-room matching (no TPE, no BYC on cap-space deals) | derived | ❌ engine assumes over-cap match always |
| **distance to tax / tax $ bill + repeater** | P1 | tax bracket calc (escalating + ×repeater) | derived + bracket table | 🟡 tier only; no $ calc |
| **distance to apron 1 / apron 2** | P0 | tool eligibility; aggregation ban; take-back limit | derived | 🟡 tier known; consequences partly encoded |
| **hard-cap line + trigger reason** | P0 | using NTMLE/BAE/S&T-acquire/sign>TaxMLE → hard-capped at 1st apron for year; can make a matching-legal trade illegal | derived | ❌ **highest-value missing rule** |
| **apron history / prior-2nd-apron flags** | P0 | frozen pick 7 yrs out | new team-season table | ❌ (so `is_frozen` not derivable) |
| **roster count (std) + open spots** | P0 | end at 14-15; can't drop <14 >2wks; absorb room | derived | ❌ never checked |
| **two-way slot count (max 3)** | P1 | two-way signings/trade-in | derived | ❌ |
| **TPEs available** (amount, created, expiry, used) | P0 | absorb incoming ≤amount+$250K; 1 player/TPE; 1-yr; unusable over 2nd apron | **Spotrac TPE/deadline primer** | 🟡 `team_exceptions(kind='tpe')` exists; engine ignores; no created/used |
| **MLE type+amount+used** (NTMLE 14.104 / TaxMLE 5.685 / RoomMLE 8.781, 25-26) | P1 | exception sizing; hard-cap trigger | Hoops Rumors | 🟡 `kind='mle'`; no sub-type/used |
| **BAE amount + every-other-yr state** | P1 | $5.134M; under-1st-apron only | Hoops Rumors | 🟡 `kind='bae'`; no eligibility state |
| **Room exception** ($8.781M) | P1 | cap-room teams | Hoops Rumors | 🟡 `kind='room'` |
| **cap holds** (label, amount, renounceable) | P0 | FA/draft/empty-roster charges vs cap until renounced | **Spotrac team cap pages** + salaryswish | ✅ well-shaped; unused by engine |
| **min team salary compliance** | P1 | ≥90% of cap floor | derived | 🟡 `season_cap.min_team_salary` exists, **but TS type omits it** |
| **cash in/out this season** (≤~$7.5M; 2nd-apron can't send) | P1 | trade legality | manual | ❌ |

### 1.4 DRAFT PICK

| Field | Pri | Rule / feature | Source | Status |
|---|---|---|---|---|
| `id`, `season`, `round`, `owning_team_id`, `original_team_id` | P0 | identity; 7-yr window; Stepien(1st only); lineage | RealGM | ✅ |
| `protections` (jsonb) | P0 | lottery/top-N/year windows; conveyance; rollover→2nds | **RealGM prose → parser + manual** | ✅ field; ❌ empty + needs defined shape |
| `is_swap` (bool) | P1 | swap rights (favorable/unfavorable) distinct asset | RealGM (orange-coded) | ✅ field; empty |
| `is_frozen` (bool) | P0 | 2nd-apron team's 7-yr-out 1st frozen | derived from apron history | ✅ field; ❌ trigger not modeled |
| **Stepien-eligible (computed)** | P0 | no consecutive future 1sts | engine scan of owned firsts | ❌ |
| **conveyed/settled status** | P0 | used pick can't re-trade | RealGM/Spotrac | ❌ |
| **pick value tier / projected slot** | P2 | valuation, auto-fixer, fairness grade | nbasense/GraphCalc/Pelton curve + standings | ❌ |

### 1.5 LEAGUE / SEASON

| Field | Pri | Rule / feature | Source | Status |
|---|---|---|---|---|
| `season` | P0 | keys everything | — | ✅ |
| `salary_cap / tax_line / first_apron / second_apron` | P0 | tiers; max %; exception sizing | NBA official / Spotrac / salaryswish (w/ confirmed date) | ✅ (but **dual source of truth** SQL vs constants.ts) |
| `min_team_salary` | P1 | floor | NBA official | 🟡 in SQL, **omitted from TS type** |
| **matching brackets** (≤$7.5M→200%+$250K; $7.5–29M→+$7.5M; >$29M→125%+$250K; apron 100%) | P0 | core matching | CBA + Sports Business Classroom | 🟡 hardcoded in `constants.ts`; thresholds rise with cap → should be season-scoped DB data |
| **min-salary scale by YOS** | P0 | min fills; vet-min reimbursement (3+YOS counts at 2-YOS $) | Hoops Rumors | ❌ |
| **rookie-scale table by slot** | P1 | rookie deals; option yrs; ext caps | Hoops Rumors/RealGM | ❌ |
| **max-salary tiers** (25/30/35% by YOS) | P1 | max validation; kicker-at-max | NBA/CBA | ❌ |
| **MLE/BAE/Room per-season $** | P1 | exception sizing | Hoops Rumors | 🟡 not stored per-season |
| **tax brackets + repeater rates** | P1 | tax bill | CBA / Spotrac | ❌ |
| **league calendar** (deadline, Dec 15, Jan 15, Jan 7-10, moratorium, Dec 16 agg cutoff) | P0 | date-aware eligibility | Hoops Rumors / ESPN Bobby Marks | ❌ |
| **future-year cap projections** (~10%/yr smoothing) | P1 | multi-year legality; forward cap sheets | thirdapron/CBA Guide/salaryswish | 🟡 only 2025-26 row |
| **min-roster/incomplete-roster charge** | P1 | team salary for under-cap teams | CBA | ❌ |

### 1.6 NEW ENTITIES TO ADD

| Entity | Pri | Purpose | Source |
|---|---|---|---|
| `player_metrics(player_id, season, source, metric, value)` | P2 | value grade, fit, injury-aware | DARKO/EPM/LEBRON scrape + nba_api |
| `pick_value_curve(slot, value)` | P2 | pick valuation | published curves (static table) |
| `team_projected_record(team, season)` | P2 | map future pick → expected slot | standings/odds feed |
| `team_season_apron_history(team, season, over_second_apron)` | P0 | frozen-pick derivation | Spotrac/derived |
| `transactions(date, type, detail, source)` + `data_version/updated_at` | P1/P2 | currency log + freshness stamp | BBRef/Hoops Rumors transactions |
| `player_status(player_id, status, games_missed, note, updated_at)` | P2 | injury-aware value | injury report / nba_api |

---

## SECTION 2 — FEATURE + VALIDATION MATRIX

Legend: ✅ full · 🟡 partial · ❌ none · ❓ unverified.

| Capability / data point | Fanspo | ESPN | Spotrac | SalarySwish | RealGM | Ours-now | **Ours-target** |
|---|---|---|---|---|---|---|---|
| Max teams per trade | 5 | ~4 | **10** | multi | multi | 4 | **≥10** |
| Trade players | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trade draft picks | ✅ | ❌ | ✅ | ✅ | 🟡 | ❌ (salary:0) | ✅ |
| Trade cash (enforce $7.5M cap) | 🟡 | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Trade player rights | ✅ | ❌ | ✅ | ❓ | ❌ | ❌ | ✅ |
| TPE as usable asset | 🟡 | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Salary matching (exact bands) | ✅ | 🟡 legacy | ✅ | ✅ | ✅ | ✅ | ✅ |
| Luxury tax $ + repeater | ✅ | ❌ | ✅ | ✅ | 🟡 | ❌ | ✅ |
| First apron rules | 🟡 | ❌ | ✅ | ✅ | ❌ | 🟡 | ✅ |
| Second apron (no agg / no TPE / take-back limit) | 🟡 | ❌ | ✅ | ✅ | ❌ | 🟡 (agg only) | ✅ |
| **Hard-cap tripwire + which move triggered** | ❓ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Restriction toggle (Off/In-season/Deadline) | ❌ | ❌ | **✅** | 🟡 | ❌ | ❌ | ✅ + real dates |
| No-trade-clause enforcement | 🟡 | ❌ | ✅ | ❓ | ❌ | ❌ (data only) | ✅ |
| **Trade bonus folded into matching** | ❓ | ❌ | ❓ | ❓ | ❌ | ❌ | **✅ white space** |
| **Base-Year Compensation** | ❓ | ❌ | ❓ | ❓ | ❌ | ❌ | **✅ white space** |
| Poison-pill valuation | ❓ | ❌ | ✅ | ❓ | ❌ | ❌ | ✅ |
| Cannot-aggregate-2-mo timing | 🟡 | ❌ | ✅ | ❓ | ❌ | ❌ | ✅ |
| **Trade-eligibility dates (Dec15/3-mo/Jan15)** | ❓ | ❌ | 🟡 | ❓ | ❌ | ❌ | **✅ date-aware** |
| Sign-and-trade legality (apron block, 3-yr min, hard cap) | 🟡 | ❌ | ✅ | 🟡 | 🟡 | ❌ | ✅ |
| **Stepien rule** | ❓ | ❌ | ❓ | 🟡 | ❌ | ❌ | **✅ white space** |
| 7-years-out pick limit | ❓ | ❌ | ❓ | 🟡 | ❌ | ❌ | ✅ |
| Pick protections (top-N/rollover/convert) | ✅ | ❌ | 🟡 | ✅ | ❌ | ❌ | ✅ |
| Pick swaps | ❓ | ❌ | 🟡 | ✅ | ❌ | ❌ | ✅ |
| TPE generation (correct $+expiry) | 🟡 | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| TPE chaining (multi→one) | ❓ | ❌ | 🟡 buggy | ❓ | ❌ | ❌ | **✅ beat Spotrac bug** |
| Cap holds (renounce → room) | ✅ | ❌ | 🟡 | ✅ | 🟡 | ❌ (data only) | ✅ |
| Dead money display | 🟡 | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Options shown/toggleable | ✅ | ❌ | ✅ | ✅ | 🟡 | 🟡 | ✅ |
| Guarantee / partial $ | 🟡 | ❌ | ✅ | ✅ | ❌ | 🟡 | ✅ |
| Bird / Early / Non rights | 🟡 | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Multi-year cap projection | 🟡 | ❌ | 🟡 | **✅ to 2032-33** | 🟡 | ❌ | ✅ |
| Free-agent signing in tool | ✅ | ❌ | 🟡 | 🟡 | ❌ | ❌ | ✅ |
| Contract edit / extensions | ✅ | ❌ | 🟡 | 🟡 | ❌ | ❌ | ✅ |
| **"Why it fails + exact fix" + CBA citation** | ✅ msg only | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 (msg) | **✅ line-by-line audit trail (white space)** |
| Shareable trade link/card | ✅ | 🟡 | ✅ | ✅ | ✅ (Trade ID) | 🟡 (`trades` table) | ✅ |
| Community feed / vote / comment | ✅ | ❌ | 🟡 | ❌ | 🟡 forum | ❌ | ✅ |
| Projected record / win impact | 🟡 LEBRON | ✅ PER | ❌ | ❌ | ❌ | ❌ | ✅ (EPM/DARKO composite) |
| Fairness / value grade | ❌ (community votes) | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ composite + surplus value** |
| Team-needs / fit analysis | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ white space** |
| "Make this trade legal" auto-fixer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ signature white space** |
| Data-currency honesty (flag unconfirmed) | ❌ | ❌ | 🟡 | **✅** | ❌ | ❌ | ✅ |
| Mobile app/PWA | ✅ | ❌ | ✅ | 🟡 | ❌ | ❌ | ✅ |

**Read of the field:** Spotrac = rules/breadth bar (10 teams, restriction toggle, hard-cap). SalarySwish = data-depth bar (cap holds, dead money, Bird, 7-yr projection, honesty flag). Fanspo = UX/community/virality bar. ESPN = obsolete (players-only, matching-only). The white space nobody fills: **transparent CBA-cited audit trail, date-aware legality with "legal on <date>", BYC/kicker/poison-pill/TPE-chaining edge math, first-class pick legality (Stepien/swaps), auto-fixer, fairness+fit grading.**

---

## SECTION 3 — DATA-SOURCE PLAN (primary + cross-check per field family)

**Hard constraint:** Spotrac, Basketball-Reference, RealGM all return **HTTP 403 on server-side fetch** (Cloudflare/anti-bot). Scraping needs a real-browser fingerprint (Playwright + stealth or residential proxy + UA rotation), ≤15 req/min. Hoops Rumors and NBA.com stats are fetchable (NBA.com needs headers; blocks cloud IPs → run from residential/local). **No single source gives CBA-grade detail** (partial-gtd $, guarantee dates, signed-via, Bird, restriction dates) as a structured feed → a manual override layer is non-negotiable.

| Field family | DB target | Primary | Cross-check | ToS / cost / flag |
|---|---|---|---|---|
| Base per-year salary | `contracts.salary` | **BBRef scrape (have)** | Spotrac, balldontlie GOAT `base_salary` | BBRef 403/rate-limited; tolerated low-vol |
| Option type | `option_type` | BBRef flags (have) | Spotrac, RealGM | needs split from two_way/non_gtd |
| Guarantee flag | `guarantee_status` | BBRef (have) | Spotrac | flag only |
| **Partial-gtd $ + date** | `partial_guarantee_amount` | **Spotrac page detail** | **manual curation** | ⚠️ no clean machine source → curate |
| Trade kicker % | `trade_bonus_pct` (new) | **Hoops Rumors kicker list** (name+%, ~33 players) | Spotrac bonuses | fetchable, easy parse; compute $ |
| No-trade clause | `no_trade_clause` | **Hoops Rumors** (LeBron etc.) | Marc Stein | hard-code; trivial |
| Signed-via / Bird rights | `signed_via`,`bird_rights` (new) | **manual curation** | thirdapron/capsheets writers | ⚠️ no public structured source → curate |
| Incentives (likely/unlikely) | new | **Spotrac bonuses** | Hoops Rumors | partial; curate classification |
| Dead money / stretch | new/`cap_holds` | **Spotrac dead-money rankings** | basketballnews | Spotrac strongest |
| TPEs | `team_exceptions` | **Spotrac TPE/deadline primer** (team,$,source player,expiry) | RealGM, thirdapron | parse primer; semi-manual |
| MLE/BAE/Room | `team_exceptions` | **Hoops Rumors** (per-season values) | thirdapron/capsheets | annual |
| Cap holds | `cap_holds` | **Spotrac team cap pages** | salaryswish | Spotrac primary |
| Draft inventory + protections + swaps | `draft_picks` | **RealGM detailed/tradeable** (color-coded; prose protections) | Spotrac/Tankathon | ⚠️ prose→jsonb parser + human-verify ~30 ambiguous |
| Stepien/frozen logic | `is_frozen`, computed | **derived in engine** | RealGM | compute, don't source |
| Trade-eligibility/agg-lock dates | `trade_restrictions` | **Hoops Rumors eligibility/restriction lists** | ESPN Bobby Marks, Spotrac restrictions page | fetchable; re-run at deadline |
| Season cap/tax/apron lines | `season_cap` | **Spotrac CBA/cap** | **salaryswish (w/ confirmed date)** | cross-check critical; collapse dual source-of-truth |
| Future cap projections | `season_cap` future rows | **thirdapron / CBA Guide / salaryswish** | NBA memos | projections; curate per offseason |
| Player bio (pos/age/YOS) | `players` | **BBRef** (backfill nulls) | balldontlie, nba_api | YOS critical; currently null |
| Injury status | `player_status` (new) | **balldontlie injuries ($9.99)** or sportsdata.io | nba_api/ESPN | API cleaner than scrape |
| Player stats (grading) | `player_metrics` (new) | **NBA.com nba_api (free)** | balldontlie averages | headers + non-cloud IP |
| Player value/rating | `player_metrics` | **DARKO** (+EPM, LEBRON) | BBRef BPM/VORP | ⚠️ display-with-attribution; not redistribution-licensed → legal flag |

**Manual-curation-only fields (no good machine source):** (1) partial-gtd $ + guarantee dates; (2) signed-via / Bird tier; (3) BYC inputs (re-sign % + timing); (4) draft-pick protections as structured data; (5) incentive likely/unlikely classification; (6) future projected cap/tax/apron.

**Licensed-API options:** Spotrac Developer API (richest cap/contract/bonus/transaction; enterprise contact-sales, opaque price — could collapse 4 scrapers into one legit feed; **get a quote**). balldontlie GOAT $39.99/mo (contracts endpoint = `cap_hit/total_cash/base_salary` only — **no options/gtd/Bird** → cheap base-salary+stats+injuries cross-check, useless for rules). sportsdata.io / API-Sports / Sportradar = stats only, no CBA mechanics.

**Recommended architecture:** BBRef scrape (salaries/options/gtd/bio, harden for 403) + RealGM scrape + protection parser (picks) + Spotrac scrape OR API (TPE/dead money/holds/cap lines/incentives) + Hoops Rumors parsers (kickers %, NTC, restriction dates) + balldontlie GOAT + nba_api + DARKO/EPM (grading) + **a manual override Neon table that wins over all scraped values.**

---

## SECTION 4 — SUPERIORITY FEATURES (ranked impact/effort)

| Rank | Feature | Impact | Effort | Exact data needs / source |
|---|---|---|---|---|
| 1 | **Forward year-by-year cap sheets w/ correct option handling** (Holmgren $13M vs $41M; Fanspo's most-complained surface) | High | Low | `contracts` (have) + `cap_holds` + `season_cap` future rows (~10%/yr). BBRef + override + projections |
| 2 | **Apron/hard-cap plain-English explainer** ("this S&T hard-caps DAL at $195.9M; post-trade $198.2M > it → illegal") | High | Low | none new — presentation over engine's structured result; extend error to include triggering line + distance |
| 3 | **"Make this trade legal" auto-fixer** (suggest minimal filler/pick/TPE route; one-click apply) — nobody has this | Very High | Med | all rostered `contracts`, `team_exceptions`, `trade_restrictions` (avoid untradeable), `draft_picks`. Internal search over the 4 empty tables (need TPEs populated) |
| 4 | **CBA-correctness completion** (hard-cap, 1st-apron tool blocks, cap-room absorption, TPE usage, Stepien/frozen, BYC, poison-pill, S&T, NTC, kicker, min-floor, simultaneous vs non-simultaneous) — THE accuracy moat | Very High | Med-High | `trade_bonus_pct`, `bird_rights`, `signed_via`, `signed_date`, `is_rookie_scale_extension` (new) + populated `team_exceptions`/`draft_picks`. CBA refs (Hoops Rumors, SBC, cbafaq, cbaguide) |
| 5 | **Trade-eligibility DATE projection** ("illegal now — legal Jan 15") + future-date sim | High | Med | `trade_restrictions` (kind/eligible_date/cannot_aggregate_until) computed from `signed_date`+`bird_rights`+raise%+ext structure. QA vs Hoops Rumors/ESPN |
| 6 | **Real-time currency + freshness stamp** ("data as of <ts>" + changelog) — half the stated moat | High | Med | `transactions` log + `data_version/updated_at`. BBRef/Hoops Rumors/RealGM transaction logs + override |
| 7 | **Draft-pick valuation curve** (real number, not $0; folds into auto-fixer + grade) | High | Med | `draft_picks` (protections jsonb) + static `pick_value_curve` + `team_projected_record`. nbasense/GraphCalc/Pelton + standings |
| 8 | **Composite fairness/value grade** (on-court impact + contract surplus + pick value + age/term; beats Fanspo's LEBRON-only) | High | Med-High | `player_metrics` (epm/darko/lebron) + age + YOS + contract + position; $/win conversion constant. DARKO/EPM/LEBRON scrape |
| 9 | **SEO pages + share graphics** (per-player/per-team static pages; OG images) — compounding organic growth | Med-High | Med | all contract/cap/restriction data already rendered; OG route + sitemap exist |
| 10 | **Waive / stretch / buyout modeling** (dead money across years; stretch = remaining×2+1) | Med-High | Med | `guarantee_status`, `partial_guarantee_amount` (have) + YOS. Pure formula |
| 11 | **Team-needs / fit analysis** (depth chart, age curve, salary-by-position, shooting/rim/playmaking gaps) — nobody does it | High | Med-High | `players.position` (backfill null) + per-player stat profile (`player_metrics`). nba_api |
| 12 | **5-6 team trades** (Fanspo does 5) | Med | Low-Med | none — engine already per-team |
| 13 | **Mobile UX** (swipeable carousel, sticky validation) | Med | Med | internal |
| 14 | **Injury-aware value** (discount injured/chronically-out; "buying low") | Med | Med | `player_status`. injury report + nba_api game logs |

**Strategic read:** Ranks 1-6 are the correctness+currency moat and are *cheap* because they ride data we already have or small static tables — that's where "clearly better than Fanspo" is won fastest. Ranks 7-11 (value/fit/pick-val/injury) all gate on **one shared infrastructure epic: a stats + impact-metric ingestion pipeline** (nba_api box/advanced + DARKO/EPM/LEBRON + backfill null position/age/YOS) — build once, four features unlock together.

---

## SECTION 5 — GAP SUMMARY (ordered build list)

The current **6-field contract + 2-rule engine** validates almost nothing. We are behind ESPN on assets (no picks/cash) and behind everyone on rule coverage (2 of ~20). Ordered build list:

**Phase 0 — schema hygiene (unblocks everything):**
1. Split overloaded `contracts.option_type` → `option_type` enum (team/player/eto/none) + `is_two_way` bool + keep `guarantee_status` separate.
2. Add contract fields: `trade_bonus_pct`, `bird_rights`, `signed_via`, `signed_date`, `acquired_date`, `is_rookie_scale_extension`, `likely_incentives`, `unlikely_incentives`, `cap_hit`/`paid_salary` split, option/guarantee dates.
3. Fix `SeasonCap` TS type to include `min_team_salary` (SQL has it, type drops it).
4. Collapse the **dual source of truth** for cap numbers: move matching brackets + $7.5M/$29M thresholds + MLE/BAE/min-scale/max-tiers/tax-brackets out of hardcoded `constants.ts` into per-season DB rows (thresholds rise with the cap).
5. Backfill the null `players.position/age/years_of_service`.

**Phase 1 — populate the 4 empty tables (the literal accuracy moat):**
6. `draft_picks` (RealGM inventory + prose→jsonb protection parser + human-verify).
7. `team_exceptions` (Spotrac/Hoops Rumors TPEs/MLE/BAE/Room; add created/used).
8. `cap_holds` (Spotrac team cap pages).
9. `trade_restrictions` (computed from `signed_date`/`bird_rights`/ext + Hoops Rumors cross-check).
10. New: `team_season_apron_history`, `player_metrics`, `pick_value_curve`, `transactions`.

**Phase 2 — compute team salary properly:** replace opaque `preTradeSalary` with a derived value from contracts + holds + exceptions + min-roster charges (two-ways excluded; unlikely bonuses included for apron only); add cap-space + tax $ + apron-distance computations.

**Phase 3 — engine rules (each a tested module returning a CBA-cited verdict), in order:**
11. Hard-cap detection + trigger reason (highest-value missing rule).
12. First-apron tool blocks (already enumerated in `APRON_2025_26.blockedTools`, not enforced).
13. Cap-room absorption path (under-cap teams don't match).
14. TPE consumption (absorb without matching; chaining).
15. Roster counts (14/15 + 3 two-way).
16. NTC consent gate (data present, unenforced).
17. Trade bonus folded into incoming matching.
18. BYC + poison-pill computed dual-values.
19. Sign-and-trade mechanics (1st-apron hard cap; 2nd-apron block; 3-yr min).
20. Stepien + 7-yr window + frozen-pick + conveyance.
21. Date-aware eligibility (3-mo/Dec15/Jan15/2-mo agg/6-mo ext).
22. Minimum-team-salary floor; tax-bracket + repeater $ calc.

**Phase 4 — superiority layer:** forward cap sheets, plain-English explainer, auto-fixer, pick valuation, composite grade, fit analysis, currency stamp, SEO/share, then community (feed/votes/comments — `trades.slug/payload` already anticipates this; it is Fanspo's real retention moat and must ship to win).

**One-line thesis:** Our four empty tables are precisely Fanspo's four biggest weaknesses (eligibility dates, cap holds, TPE/hard-cap triggers, pick legality). Filling them with rigorous, CBA-cited logic — plus a stats/value pipeline for grading and fit — is the entire accuracy-and-depth moat. Verify exact Fanspo denial strings and per-player field list against the live SPA during build (its static pages expose only marketing copy).

---

# ADDENDUM — gaps found by the adversarial completeness critic

Below is the complete addendum, ready to append to the audit. Field tables use the audit's existing format: `field | priority | rule-or-feature served | primary source | status`.

---

# ADDENDUM — Completeness Gaps (25 items the critic flagged)

This addendum fills holes the main audit named loosely or missed entirely. **The single highest-leverage correction is #A1: the engine has ONE `maxIncomingSalary()` that silently conflates two structurally different trade types.** Everything in #A1–#A4 cascades from that. Verified facts are sourced inline; numbers are 2025-26 unless noted.

Status legend unchanged: ✅ HAVE · 🟡 PARTIAL · ❌ MISSING. Priority: **P0** = CBA-correctness · **P1** = Fanspo parity · **P2** = differentiator.

---

## A1 — SIMULTANEOUS vs NON-SIMULTANEOUS TRADE (the structural fork) — **P0, the un-named hole**

The bracket table the audit cites (200%+$250K / outgoing+$7.5M / 125%+$250K) is the **Simultaneous Traded Player Exception (S-TPE)** path *only*. A non-simultaneous trade matches completely differently and *generates* a TPE. The engine's single `maxIncomingSalary()` models neither correctly because it never branches on trade method.

**The fork (2023 CBA):**
- **Simultaneous** (everything in/out settles at once, per team): take-back uses the expansion brackets below. No TPE generated for that team (the expansion *is* the room).
- **Non-simultaneous / Standard TPE** (one player out, less salary in than out): take-back capped at **100% of outgoing + $250K** (the $250K cushion is **removed once the team is over the first apron**). NO 200%/125% expansion. The unused room becomes a **TPE** the team holds for 12 months. ([CBA Guide — TPE](https://cbaguide.com/transactions/trades/tpe/))
- A trade **MUST be non-simultaneous** when: (a) the team is **using a pre-existing TPE** to absorb salary, or (b) the team is **generating** a TPE (sends out more than it takes back in that slot). Only teams **below the first apron** may use the **Expanded TPE** to take back *more* than they send (e.g. OKC took back Caruso's $9.4M for Giddey's $6.5M). ([CBA Guide — Trade Salary / SBC](https://sportsbusinessclassroom.com/understanding-trade-matching-in-the-new-collective-bargaining-agreement/))

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `trade_method` enum (`simultaneous` \| `non_simultaneous`) per team-leg | P0 | selects matching formula; engine fork | computed by engine | ❌ no field/flag |
| `generates_tpe` (bool, per team-leg) | P0 | forces non-simultaneous path; produces TPE row | computed | ❌ |
| `uses_existing_tpe` (FK → `team_exceptions.id`) | P0 | forces non-simultaneous; absorption-without-match | computed + `team_exceptions` | ❌ |
| `expanded_tpe_eligible` (bool) | P0 | take-back > outgoing only if below first apron | derived from apron tier | ❌ |
| Engine: `maxIncomingSalary(method, tier)` split into `simultaneousMatch()` vs `nonSimultaneousMatch()` | P0 | core correctness; current single fn is wrong for TPE legs | `lib/cba/matching.ts` | 🟡 conflated |

---

## A2 — TPE GENERATION MATH (formula + simultaneous split) — **P0**

Section 1.3 lists "amount, created, expiry, used" but gives no generation algorithm. Spec it:

- **TPE amount = (outgoing Trade Salary of the slot that generates it) − (incoming matched against that slot).** The $250K/$100K padding is on the **take-back limit, not the TPE size** — do NOT add $250K to the generated TPE.
- A TPE absorbs **one incoming player per exception** ("one outgoing Player," non-simultaneous). It **cannot be aggregated** with other salary or with another TPE to absorb a single larger player (Standard TPE). ([CBA Guide — TPE](https://cbaguide.com/transactions/trades/tpe/))
- TPE absorption capacity when *using* it = **TPE amount + $250K** (the $250K cushion **eliminated if the team is over the first apron**).
- **Expiry: 12 months** from creation (shorter if over first apron). **Second-apron teams cannot use TPEs at all** (and cannot use the Aggregated TPE).
- A player **acquired via a TPE** is itself **non-aggregable for 2 months** from acquisition.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `team_exceptions.amount` (generated $) | P0 | = outgoing − incoming on generating slot | computed | 🟡 col exists, no gen algo |
| `team_exceptions.created_date` | P0 | 12-month expiry clock | trade event | ❌ |
| `team_exceptions.expires_date` | P0 | 12mo (or shorter over apron 1) | computed | 🟡 col exists, unpopulated |
| `team_exceptions.source_player_id` | P1 | provenance / display ("TPE from trading X") | trade event | ❌ |
| `team_exceptions.used_amount` / `is_used` | P0 | partial-use tracking (Standard TPE = single use, no chaining) | computed | ❌ |
| Rule: TPE non-aggregable; 1 player/TPE; unusable over 2nd apron; $250K cushion gone over apron 1 | P0 | absorption legality | [CBA Guide TPE](https://cbaguide.com/transactions/trades/tpe/) | ❌ in engine |

---

## A3 — FIRST-APRON TAKEBACK: "currently over" vs "trade crosses" — **P0 (current data model is wrong)**

`matching.ts` returns `outgoing * apronTakebackPct` for both apron tiers off `preTier`. That mishandles a team that **starts below** the first apron and **ends above** it.

**Correct rule:** the **100% (1:1) hard take-back cap applies to teams that are OVER the first apron.** A team **below** the first apron uses the **normal expansion brackets** even if the trade pushes it over — it is **not** retroactively limited to 100%; instead it incurs the **hard-cap consequence** (hard-capped at the first apron for the rest of the league year, so the *resulting* salary cannot exceed the apron). One day after the 2023-24 regular season the over-apron match locks to 100%. ([SBC — Trade Matching](https://sportsbusinessclassroom.com/understanding-trade-matching-in-the-new-collective-bargaining-agreement/))

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `apron_tier_pre` / `apron_tier_post` (per team) | P0 | distinguish "over now" (100% match) from "crosses" (normal match + hard cap) | computed both pre & post | 🟡 only `preTier` |
| `match_formula_tier` (resolved AFTER incoming applied) | P0 | bracket must be evaluated on final salary, not pre-trade | iterative engine | ❌ |
| Rule: 100% take-back ⇐ *currently* over first apron; below→over uses brackets + hard-cap | P0 | core matching correctness | SBC / CBA Guide | 🟡 mis-encoded |
| Engine: stop using `preTier` for the bracket lookup; compute crossing | P0 | fixes silent mis-handling | `lib/cba/matching.ts` | ❌ |

---

## A4 — AGGREGATION-/APRON-DEPENDENT MATCHING TIER (fixed-point) — **P0**

The bracket a team gets depends on its apron status, and **incoming salary can push the team across the first apron mid-construction**, changing which bracket/cap applies. This is a fixed-point problem the audit never names.

**Spec:** evaluate matching **iteratively**: (1) compute pre-trade tier; (2) apply candidate incoming; (3) recompute tier on the *post* salary; (4) if the team crossed the first apron, re-test under the 100%/hard-cap regime; (5) converge. Under 2023 CBA the legacy taxpayer (125%+$100K) vs non-taxpayer split is **superseded by apron-keying**, but the iterative crossing test replaces it and must be stated.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| Engine: fixed-point tier resolution (pre→apply→recompute→re-test) | P0 | bracket can change mid-construction | engine | ❌ |
| `crosses_first_apron` (bool, derived) | P0 | triggers hard-cap branch + 100% regime | computed | ❌ |
| `is_taxpayer_pre` (legacy split, doc-only) | P2 | explanatory parity vs old tools | derived | ❌ |

---

## A5 — CASH IN TRADES (full spec) — **P1**

Audit lists one "cash in/out (≤~$7.5M)" field. The real rule set, **verified**:

- League-wide cash limit = **5.15% of the salary cap per cap year = $7,964,320 for 2025-26** (indexed annually; the "$7.5M" figure is stale). ([Hoops Rumors — Cash in Trade 2025/26](https://www.hoopsrumors.com/2025/08/cash-sent-received-in-nba-trades-for-2025-26.html))
- **Sending and receiving limits are SEPARATE** and not netted: a team that sends $7.96M and later receives $7.96M has exhausted **both** caps for the season.
- **Second-apron teams cannot SEND OR RECEIVE cash** (audit only said "can't send").
- Cash **counts toward neither salary matching nor TPE** — it cannot acquire a player the way salary does.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `season_cap.cash_in_trade_limit` ($, = 5.15% × cap) | P1 | per-season cash cap | NBA / Hoops Rumors | ❌ |
| `team_season.cash_sent_used` ($, running) | P1 | separate send accounting | derived from trades | ❌ |
| `team_season.cash_received_used` ($, running) | P1 | separate receive accounting | derived | ❌ |
| Rule: 2nd-apron team cannot send **or** receive cash | P0 | hard block | CBA Guide | 🟡 audit half-right |
| Rule: cash excluded from matching & TPE | P0 | prevents mis-match | CBA | ❌ |

---

## A6 — MINIMUM-SALARY EXCEPTION as acquisition path — **P0**

A team can **always** acquire a player on a **minimum-salary contract** via the **Minimum Player Salary Exception**, regardless of cap/tax/apron, **without salary matching**. The audit lists the min-salary *scale* (filling roster) but never the *exception* as an absorption path.

- Min contracts of **1-2 years** are acquirable by any team via this exception (over the cap, over either apron).
- Min, **10-day**, and **two-way** deals interact with matching differently (min exception bypasses match; two-ways excluded from team salary; 10-days are min by definition).

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.is_minimum` (bool) | P0 | qualifies for min-exception absorption | derived (salary == min scale) | ❌ |
| Rule: min-salary exception absorbs incoming min player w/o matching | P0 | major matching bypass | CBA / Hoops Rumors | ❌ |
| `contract.length_years` ≤ 2 gate for min-exception | P0 | exception only for ≤2-yr min deals | derived | ❌ |
| Min/10-day/two-way matching-interaction flags | P1 | correct match treatment | derived | 🟡 two-way buried in overloaded col |

---

## A7 — OVER-38 RULE (formerly over-36) — **P0, entirely absent**

For any contract **4+ years** that includes a season where the player is **38+**, salary for the over-38 ("zero") years is **reallocated/deferred into earlier years for cap purposes** — so **cap hit ≠ paid salary** per season, directly changing each year's **matching value and tradeability**. (Full-Bird 35/36 re-signs with prior team have softened reallocation; 4-yr = none, 5-yr = only year 5 reallocated.) ([Hoops Rumors](https://www.hoopsrumors.com/2018/06/hoops-rumors-glossary-over-38-rule.html), [RealGM](https://basketball.realgm.com/analysis//248182/CBA-Encyclopedia-Over-38-Rule)) Affects tradeable vets (LeBron, CP3, KD-aged deals).

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.over_38_applies` (bool) | P0 | triggers reallocation; cap≠paid | derived (age@season + term≥4) | ❌ |
| `contract.cap_hit` vs `paid_salary` per year (already flagged in 1.1) | P0 | reallocated cap hit drives matching | computed | 🟡 conflated in `salary` |
| `players.birth_date` (not just `age`) | P0 | exact age-at-season for the test | BBRef | ❌ (age null) |

---

## A8 — DESIGNATED-ROOKIE / DESIGNATED-VETERAN trade blocks — **P0**

Two categorical hard blocks, both missing:
- **Designated-rookie (Rose Rule):** a team may hold **at most TWO** designated-rookie-extension players, and **at most one acquired via trade**. A trade that would give a team a **second designated-rookie** player is **blocked** (the deal cannot be made). ([CBS — CBA 101](https://www.cbssports.com/nba/news/nba-cba-101-everything-to-know-about-new-agreement-from-salary-cap-to-free-agency-and-beyond/))
- **Designated-veteran (supermax):** a player who signs a designated-veteran extension generally **cannot be traded for one year** after signing.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.is_designated_rookie` (bool) | P0 | ≤2-per-team, ≤1-acquired block | manual curation | ❌ |
| `contract.is_designated_veteran` (bool) | P0 | 1-year no-trade after signing | manual curation | ❌ |
| `contract.designated_signed_date` | P0 | computes the 1-yr supermax trade freeze | manual | ❌ |
| `team_season.designated_rookie_count` (derived) | P0 | enforce ≤2 / ≤1-via-trade | derived | ❌ |
| Rule: block second designated-rookie acquisition | P0 | hard trade-legality | CBA Art. II | ❌ |

---

## A9 — SET-OFF and STRETCH (mis-shaped in audit) — **P1**

Audit's "remaining ×2 + 1" is only the **waive-and-stretch** formula and is under-specified:
- **Stretch (waived):** remaining **guaranteed** money is paid/charged over **2 × (remaining years) + 1**. Distinguish **already-earned** (current-season) vs **future** salary — current-season portion is generally **not** stretched.
- **Stretch of TRADED dead money** differs from a straight waive-stretch.
- **Set-off:** if the waived player signs elsewhere, the waiving team's obligation is reduced by **one-half of (new contract amount above the one-year minimum)**.
- **15% rule:** total **stretched** dead money charged to the cap **in any one season** may not exceed **15% of that season's salary cap** (aggregate test) — caps how much can be stretched.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `dead_money(team, season, source_player, amount, is_stretched)` | P1 | team-salary input + display | computed | ❌ (no table) |
| `stretch_schedule` (per waived contract) | P1 | 2×yrs+1 spread; earned-vs-future split | computed | ❌ |
| `set_off_amount` = ½ × (new deal − 1-yr min) | P2 | reduces dead money | computed + new-deal data | ❌ |
| Rule: ≤15% of cap in stretched salary per season | P1 | blocks over-stretch | CBA | ❌ |

---

## A10 — WAIVER / CLEARING / ANTI-CIRCUMVENTION — **P1**

- Traded player's salary counts for the **acquiring** team's matching **immediately** (at trade, before clearing).
- Model the **48-hour trade-call window** and **waiver claim** mechanics for legality/eligibility display.
- **Cannot waive-and-re-sign** to circumvent matching.
- **Anti-circumvention:** a player acquired in a trade **cannot be traded back to the original team for one year** (and a **waived player cannot be re-acquired by the waiving team** for a set period — ~30 days in-season / until July 1).

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `trade_restrictions.cannot_return_to_team_until` (date) | P1 | 1-yr no-trade-back block | computed from trade event | ❌ |
| `waived_reacquire_until` (date) | P2 | re-acquisition bar after waive | computed | ❌ |
| Rule: incoming salary matches immediately (pre-clear) | P0 | matching timing | CBA | 🟡 implicit |

---

## A11 — SIGN-AND-TRADE: BYC + apron + structure — **P0**

Audit names "S&T BYC" and "3-yr min" but omits the dual-value asymmetry and apron blocks:
- **Outgoing (sending team)** value on an S&T = **greater of (prior salary, 50% of new salary)** [= BYC average]. **Incoming (receiving team)** value = **full new salary**. Match value is **asymmetric** between the two sides. ([Hoops Rumors — BYC](https://www.hoopsrumors.com/2024/05/hoops-rumors-glossary-base-year-compensation-4.html))
- The **receiving team is hard-capped at the FIRST apron** for the season.
- A team **over the first apron CANNOT ACQUIRE via S&T** (not just second apron).
- S&T contract must be **3-4 years**, with **only year 1 fully guaranteed** (years 2-4 may be non-/partially-guaranteed).
- The **signing/receiving team cannot use an S&T if it would exceed the apron** at all.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `s_and_t.outgoing_match_value` = max(prior, 0.5×new) | P0 | sending-side BYC match | computed | 🟡 flag only |
| `s_and_t.incoming_match_value` = full new salary | P0 | receiving-side match (asymmetric) | computed | ❌ |
| Rule: receiving team hard-capped at **first** apron | P0 | hard-cap trigger | CBA / Hoops Rumors | ❌ |
| Rule: over-**first**-apron team cannot acquire via S&T | P0 | hard block (broader than audit's 2nd-apron) | CBA | ❌ |
| `s_and_t.term` 3-4 yrs, yr1 fully gtd | P0 | construction legality | CBA | ❌ |

---

## A12 — REPEATER TAX + 2023 tax brackets (verified numbers) — **P1**

Audit flags "$ calc" missing. Concrete spec (**verified 2025-26**, [CBA Guide — Luxury Tax](https://cbaguide.com/thresholds/luxurytax/)):

- **Tax line 2025-26 = $187,895,000**; **bracket increment = $5,585,000** (≈$5M legacy, indexed). Brackets: $0-5.585M over, $5.585-11.17M, $11.17-16.755M, $16.755-22.34M, then +$5.585M steps.
- **Non-repeater multipliers:** **$1.00 / $1.25 / $3.50 / $4.75**, then **+$0.50 per bracket** ($5.25, $5.75, …).
- **Repeater multipliers (2025-26, harsher):** **$3.00 / $3.25 / $5.50 / $6.75**, then **+$0.50 per bracket**.
- **Repeater definition (2023 CBA):** taxpayer in **3 of the prior 4** seasons.
- **Tax is computed on TEAM SALARY at SEASON END,** not at trade time — the tool can only show a **projected** bill, and must say so.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `tax_brackets(season, bracket_index, lower, upper, std_mult, repeater_mult)` | P1 | season-scoped bracket table | CBA Guide / Spotrac | ❌ (only "bracket table" named) |
| `season_cap.tax_increment` ($5.585M, 25-26) | P1 | bracket width | CBA Guide | ❌ |
| `team_season.repeater_status` (taxpayer 3-of-4) | P1 | selects multiplier set | derived from history | ❌ |
| Rule: tax = season-end team salary (projection only) | P1 | honest "projected tax" labeling | CBA | ❌ |

---

## A13 — BASE-YEAR COMPENSATION trigger (mostly doesn't fire) — **P0 scoping fix**

**Verified:** under the 2023 CBA, **BYC was effectively eliminated for straight in-season trades and now applies essentially only in SIGN-AND-TRADE scenarios.** ([Hoops Rumors — BYC](https://www.hoopsrumors.com/2024/05/hoops-rumors-glossary-base-year-compensation-4.html)) Triggers (all must hold), in an S&T: player is a **Bird/Early-Bird FA**; **new salary > minimum**; **raise > 20%**; team is **at/over the cap immediately after signing**. Outgoing match = **greater of (prior salary, 50% of new)**. The audit treats BYC as a general live rule, risking modeling a rule that mostly does not fire.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `byc_applies` gated to S&T context only | P0 | prevents false BYC on normal trades | computed | 🟡 audit over-broad |
| BYC trigger inputs: `bird_rights`, `raise_pct`, `over_cap_post_sign`, `> min` | P0 | exact firing conditions | derived + manual | ❌ |
| `byc_outgoing_value` = max(prior, 0.5×new) | P0 | asymmetric outgoing match | computed | 🟡 flag only |

---

## A14 — ROSTER-MINIMUM-AFTER-TRADE — **P1**

Audit says "can't drop <14 >2wks" but omits the hard pre/post checks:
- **You cannot trade away a player you won't have post-deal** (the deal must be feasible from current rosters — the "touch rule" for multi-team).
- **14-player minimum** (with **2-week grace**); **you cannot make a trade that leaves you unable to meet the minimum.**
- **Max 15 standard + 3 two-way = 18.** Incoming players over 15 **force a corresponding waive**, and **that waive must itself be cap-/apron-legal**.
- **Two-way activation limit (50 games / players signed by a date)** and playoff-roster eligibility constraints.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `team.roster_count_std` / `roster_count_two_way` | P0 | 14-min / 15-max / 3-two-way | derived | ❌ |
| Rule: incoming >15 forces legal corresponding waive | P0 | post-trade roster legality | CBA | ❌ |
| Rule: trade cannot leave team < min after grace | P1 | block | CBA | ❌ |
| `two_way.games_active` (≤50) | P2 | two-way activation cap | derived | ❌ |

---

## A15 — DRAFT PICKS: Stepien vs frozen, round-specific, protection schema — **P0**

- **Stepien rule applies to FIRST-round picks only:** a team may not be **without a first-rounder in consecutive future years** (you may trade *this* year's and keep *next* year's). ([CBA Guide — Trade Rules](https://cbaguide.com/transactions/trades/traderules/))
- **Frozen pick (second-apron) is SEPARATE from Stepien:** a team **over the second apron** has its **first-rounder 7 years out frozen** (cannot be traded), independent of Stepien.
- **Second-round picks have NO Stepien limit** and can be dealt much further out — the pick model must be **round-aware**.
- **Protection schema must be structured** (audit calls it "jsonb prose"). Define:

```
protections: {
  type: "top_n" | "lottery" | "range" | "unprotected",
  top_n: int | null,                 // e.g. top-4 protected
  year_range: [startSeason, endSeason],
  conveyance_order: int,             // which obligation conveys first
  rollover: { to_round: 2 | null, years: int },  // forced-conveyance / rollover-to-2nd
  swap: { direction: "favorable" | "unfavorable", counterparty_team_id },
  forced_convey_by: season           // protection window then MUST convey
}
```

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `draft_picks.round`-aware Stepien (1st only) | P0 | Stepien scan | engine | ❌ |
| `draft_picks.is_frozen` ⇐ over-2nd-apron 7-yr-out | P0 | frozen-pick (separate rule) | derived from apron history | 🟡 col exists, trigger not modeled |
| `draft_picks.protections` (structured schema above) | P0 | conveyance / rollover / swap legality | RealGM prose → parser + manual | 🟡 col exists, shape undefined |
| `draft_picks.forced_convey_by` (season) | P1 | finite-protection forced conveyance | RealGM | ❌ |
| `draft_picks.conveyed` (bool) | P0 | settled pick can't re-trade | RealGM / Spotrac | ❌ |

---

## A16 — DEAD MONEY as an INPUT to team salary — **P0**

Audit treats dead money as display-only. Dead money from previously-waived players **counts toward team salary** (hence tax/apron tiers) but is **NOT a tradeable asset and cannot be matched against**. The Phase-2 team-salary derivation (contracts + holds + exceptions + min-roster) **omits dead money** and is therefore wrong for over-/under-apron teams.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `dead_money(team, season, amount)` summed into team salary | P0 | tax/apron tier correctness | Spotrac dead-money pages | ❌ |
| Rule: dead money in team salary, excluded from matchable/tradeable | P0 | matching + tier correctness | CBA | ❌ |

---

## A17 — INCOMPLETE-ROSTER CHARGES (the number) — **P1**

For **under-cap** teams, each **open roster slot below 12** (not 14) adds a **roster charge = the rookie minimum salary** to team salary for **cap-space** computation. Audit names "min-roster/incomplete-roster charge" with no number/threshold.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `incomplete_roster_charge` = max(0, 12 − std_count) × rookie_min | P1 | correct cap-space for under-cap teams | CBA / CBA FAQ | ❌ |
| `season_cap.rookie_min` ($, per season) | P1 | the charge amount | Hoops Rumors min scale | ❌ |
| Threshold = **12**, not 14 | P1 | correct slot count | CBA | ❌ |

---

## A18 — EXHIBIT 10 / EXHIBIT 9 / two-way tradeability nuance — **P2 / P1**

- **Exhibit-10:** can **convert to a two-way**; bonus **$5K-$77,500** earned only on conditions (e.g. 60-day G-League stint). Exhibit-10 / non-guaranteed camp deals are **NOT tradeable until a date**.
- **Exhibit-9:** injury-protection clause; flag.
- **Two-way correction:** audit's blanket "not tradeable, convert first" is an **oversimplification** — two-ways **CAN be traded** with restrictions. Flag this for accuracy.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.is_exhibit_10` + `exhibit_10_bonus` ($5K-77.5K) | P2 | convert-to-two-way; not-tradeable-until | manual | ❌ |
| `contract.exhibit_10_tradeable_date` | P2 | camp-deal trade bar | manual | ❌ |
| `contract.is_exhibit_9` (bool) | P2 | injury clause flag | manual | ❌ |
| Two-way tradeable-with-restrictions (correct the blanket "no") | P1 | accuracy vs Fanspo | CBA | 🟡 audit oversimplified |

---

## A19 — TRADE BONUS (kicker) pro-rata + side asymmetry — **P0**

Audit says kicker "adds to incoming for matching" + "voids at max" but omits:
1. Kicker is **paid by the original team**, but the **cap hit moves with the player** to the new team.
2. Kicker is **allocated PRO-RATA across remaining guaranteed years**, changing **each year's** cap hit (so which season's matching value changes is specific).
3. For the **OUTGOING** team the kicker is **NOT part of outgoing matching salary** — only the **receiving** side.
4. A kicker pushing the player **over the max is automatically reduced** (audit has the void, not the pro-rata reallocation).

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.trade_bonus_pct` (≤15%) | P0 | kicker base | Hoops Rumors kicker list | ❌ |
| `kicker_prorata[season]` (allocated $) | P0 | per-year cap-hit change | computed | ❌ |
| Rule: kicker on **incoming** match only, not outgoing | P0 | correct side | CBA | ❌ |
| Rule: auto-reduce kicker at max; remaining-gtd-years base | P0 | max-void + base | CBA | 🟡 audit has void only |

---

## A20 — FANSPO-VISIBLE DATA POINTS (display fields) — **P1/P2**

Display-layer fields Fanspo renders that have no home in the data model:

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `players.headshot_url` | P1 | player photo on trade card | NBA CDN (cdn.nba.com/headshots/.../{playerId}.png) | ❌ |
| `players.jersey_number` | P2 | card display | BBRef / nba_api | ❌ |
| `teams.logo_url` (confirm populated) | P1 | card display | seed | 🟡 |
| `contract.total_value` / `aav` (derived) | P1 | "total / AAV" display | computed from rows | ❌ |
| salary-by-season mini-table (derived) | P1 | Fanspo card per-player table | `contracts` | ✅ data, ❌ view |
| `net_salary_change` + `new_payroll` per team (derived) | P1 | headline numbers | computed | ❌ |
| `trade_grade` (letter) + `community_approve_pct` | P2 | grade + approve/reject bar | internal | ❌ |
| `players.college` / experience label | P2 | bio chip | BBRef | ❌ |
| `works_per_team` (bool badge) | P1 | "trade works/doesn't" per team | engine result | 🟡 derivable, not surfaced |

---

## A21 — PER-ROW FRESHNESS / OVERRIDE SCHEMA — **P1 (the SalarySwish honesty moat)**

Global `data_version` is insufficient. Need per-row provenance on `contracts` and `draft_picks`, plus a defined override schema.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contracts.verified_at` / `updated_at` | P1 | per-row "last verified" honesty flag | ingest | ❌ |
| `contracts.is_estimated` (bool) | P1 | flag unconfirmed values | ingest | ❌ |
| `contracts.confidence` (0-1 or enum) | P2 | honesty surfacing | ingest | ❌ |
| `draft_picks.verified_at` / `is_estimated` | P1 | pick-row freshness | ingest | ❌ |
| `manual_overrides(table, row_id, field, value, set_by, set_at, reason)` + precedence (override wins) + audit trail | P1 | defined override schema (audit only named the table) | internal | 🟡 mentioned, unspecified |

---

## A22 — OPTION-DECISION CASCADE (forward sims) — **P1**

Audit lists "option decision date" but not the **resolution logic** the forward cap sheet (Rank 1) depends on:
- A **declined** option or an unexercised **player/team option** year determines whether that year's salary is "on the books" for **future-dated** sims and projections.
- An **ETO** vs a **player option** generate **cap holds differently** when the player hits FA.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.option_decision_date` | P1 | is a future option year on the books? | manual + Spotrac | ❌ |
| `option_resolution(season)` enum (`exercised`/`declined`/`pending`) | P1 | per-year forward-sim salary inclusion | computed + manual | ❌ |
| ETO-vs-PO cap-hold generation rule | P1 | correct FA cap hold | CBA | ❌ |

---

## A23 — IMPLIED 1-YEAR NTC — **P0 (re-prioritized from audit's P1)**

A player who **re-signs via Bird rights on a one-year deal (or one-year + option)** gains an **automatic right to veto a trade** (he'd lose Bird rights if traded). This **categorically blocks aggregation/trade without consent** and Fanspo gets it wrong — a stated differentiator. Audit's "implied/1-yr NTC" row is marked P1/derived with **no enforcement rule**; promote to **P0** with an enforcement gate.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `contract.implied_ntc` ⇐ (1-yr Bird re-sign OR 1-yr+option) | P0 | de-facto consent veto | derived (term + signed_via=Bird) | ❌ |
| Rule: implied-NTC blocks trade/aggregation absent consent flag | P0 | consent gate | CBA | ❌ |
| `consent_given` (per-player, user toggle) | P0 | resolve the gate in-tool | UI input | ❌ |

---

## A24 — APRON MODEL FUTURE-PROOFING (third-apron hook) — **P2 (architecture)**

`season_cap` hardcodes `first_apron` / `second_apron` columns; the tier system is hardcoded to two aprons. If the league adds a third apron or reshapes thresholds, the schema can't represent it. Replace fixed columns with a **normalized line table**:

```
apron_thresholds(season, level INT, label TEXT, amount NUMERIC)
   level 0=cap, 1=tax, 2=first_apron, 3=second_apron, 4=third_apron?, 5=floor...
```

Engine reads tiers by querying ordered `level`s, so adding a tier is data, not code.

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `apron_thresholds(season, level, label, amount)` (normalized) | P2 | extensible tiers (3rd apron / future CBA) | NBA / projections | ❌ (fixed cols today) |
| Engine: tier resolution by ordered `level` query | P2 | no schema change to add a tier | engine | ❌ |

---

## A25 — VALIDATION SEVERITY MODEL — **P0 (blocks the signature feature)**

`TradeError` has only `code/message`. The "why it fails + exact fix" white-space feature requires a richer result type with **severity, per-team consent state, and conditional/date-pending legality.**

```
TradeVerdict {
  severity: "hard_block" | "warning" | "info",
  code, message, cba_citation,
  team_id?,                       // which team the finding applies to
  consent_required?: bool,        // NTC / implied-NTC
  legal_on_date?: ISODate,        // "illegal now — legal Jan 15"
  requires_both_under_apron?: bool,
  suggested_fix?: FixDescriptor   // feeds the auto-fixer
}
```

Examples by severity: **hard_block** (over-match, Stepien, 2nd-apron aggregation, designated-rookie #2); **warning** ("legal but triggers repeater tax", "legal but hard-caps you at first apron"); **info** ("generates a $X TPE expiring <date>", "requires player consent", "legal on <date>").

| Field | Pri | Rule / feature served | Primary source | Status |
|---|---|---|---|---|
| `TradeVerdict.severity` enum | P0 | warnings vs hard-blocks vs info | engine type | ❌ (binary today) |
| `TradeVerdict.cba_citation` | P0 | cited audit trail (white-space) | engine | 🟡 message only |
| `TradeVerdict.consent_required` / `team_id` | P0 | per-team consent state | engine | ❌ |
| `TradeVerdict.legal_on_date` | P0 | date-aware "legal on <date>" | engine + restrictions | ❌ |
| `TradeVerdict.suggested_fix` | P1 | feeds auto-fixer (Rank 3) | engine | ❌ |

---

## Cross-cutting integration notes

- **#A1–#A4 are one coupled engine refactor:** replace `maxIncomingSalary()` with a method-aware (`simultaneous` vs `non_simultaneous`), apron-crossing-aware, fixed-point matcher that emits TPE rows. This is the largest single correctness gain and should be Phase-3 item #0, ahead of the audit's current hard-cap item.
- **#A12, #A17, #A24** are all **`season_cap` schema work** — fold into the audit's Phase-0 step 4 ("collapse dual source of truth"): add `tax_brackets`, `cash_in_trade_limit`, `tax_increment`, `rookie_min`, and migrate aprons to `apron_thresholds`.
- **#A9, #A16** require a new **`dead_money`** table feeding Phase-2 team-salary; the audit's team-salary formula must be amended to **+ dead money**.
- **#A25** is a prerequisite for Superiority Ranks 2 (explainer) and 3 (auto-fixer) — without the verdict type those features cannot be built.
- **Verified-number anchors for constants:** cash-in-trade **$7,964,320** (5.15% × cap, 25-26); tax line **$187,895,000**, increment **$5,585,000**; non-repeater mults **1.00/1.25/3.50/4.75 (+0.5/bracket)**; repeater **3.00/3.25/5.50/6.75 (+0.5/bracket)**; repeater = taxpayer **3 of prior 4**; non-simultaneous take-back **100% + $250K** ($250K removed over first apron); standard TPE expiry **12 months**.

**Sources:** [Hoops Rumors — Cash in Trade 2025/26](https://www.hoopsrumors.com/2025/08/cash-sent-received-in-nba-trades-for-2025-26.html) · [CBA Guide — Luxury Tax](https://cbaguide.com/thresholds/luxurytax/) · [CBA Guide — TPE](https://cbaguide.com/transactions/trades/tpe/) · [CBA Guide — Trade Rules](https://cbaguide.com/transactions/trades/traderules/) · [SBC — Understanding Trade Matching](https://sportsbusinessclassroom.com/understanding-trade-matching-in-the-new-collective-bargaining-agreement/) · [Hoops Rumors — Base Year Compensation](https://www.hoopsrumors.com/2024/05/hoops-rumors-glossary-base-year-compensation-4.html) · [Hoops Rumors — Over-38 Rule](https://www.hoopsrumors.com/2018/06/hoops-rumors-glossary-over-38-rule.html) · [RealGM — Over-38](https://basketball.realgm.com/analysis//248182/CBA-Encyclopedia-Over-38-Rule) · [CBS — CBA 101](https://www.cbssports.com/nba/news/nba-cba-101-everything-to-know-about-new-agreement-from-salary-cap-to-free-agency-and-beyond/)

---

## Appendix A — P0 fields missing or partial in the current schema

- contracts: cap_hit vs paid_salary split (BYC/incentives diverge)
- contracts: option_type must be split from two_way/non_guaranteed (overloaded)
- contracts: trade_bonus_pct (kicker into matching)
- contracts: trade bonus remaining $ / max-cap voiding flag
- contracts: likely_incentives $ (count in cap hit + matching)
- contracts: signed_via / exception used (gates BYC, S&T, hard-cap, re-sign)
- contracts: bird_rights (bird/early/non)
- contracts: BYC computed outgoing dual-value (flag exists, no value)
- contracts: poison-pill computed dual-value (flag exists, no value)
- contracts: is_two_way bool (currently buried in option_type; excl. from cap)
- contracts: signed_date (3-mo/Dec15/Jan15 eligibility)
- contracts: acquired_date (2-month aggregation lock)
- contracts: is_rookie_scale_extension (poison-pill detection)
- contracts: partial_guarantee_amount has no clean source (BBRef flag only)
- players: years_of_service populated (null in scrape; min-salary/Bird/vet-min)
- team: hard-cap line + trigger reason (can make matching-legal trade illegal)
- team: computed team salary from contracts+holds+exceptions (engine uses opaque preTradeSalary)
- team: cap space computed (cap-room matching path)
- team: roster count + open spots (14-15 legality)
- team: apron history / prior-2nd-apron flags (frozen-pick derivation)
- team: TPEs amount+created+expiry+used (table exists, engine ignores)
- team: cash in/out $7.5M cap
- season_cap.min_team_salary missing from TS SeasonCap type
- league: matching brackets + $7.5M/$29M thresholds should be season-scoped DB (hardcoded)
- league: min-salary scale by YOS
- league: league calendar (deadline/Dec15/Jan15/moratorium/Dec16 agg cutoff)
- draft_picks: protections jsonb empty + undefined shape
- draft_picks: Stepien-eligible computed (consecutive-1sts scan)
- draft_picks: is_frozen trigger not modeled (needs apron history)
- draft_picks: conveyed/settled status

## Appendix B — Superiority features (ranked impact/effort)

1. Forward year-by-year cap sheets with correct option handling
2. Apron/hard-cap plain-English explainer with CBA citations
3. Make-this-trade-legal auto-fixer (filler/pick/TPE suggester)
4. Full CBA-correctness completion (hard-cap, BYC, poison-pill, TPE, Stepien, S&T, cap-room)
5. Trade-eligibility date projection (legal-on-date) + future-date sim
6. Real-time transaction currency + data freshness stamp
7. Draft-pick valuation curve
8. Composite fairness/value grade (impact + contract surplus + picks + age)
9. SEO player/team pages + share graphics
10. Waive/stretch/buyout cap-consequence modeling
11. Team-needs / positional fit analysis
12. 5-6 team trades
13. Mobile UX polish (swipeable carousel, sticky validation)
14. Injury-aware value
15. Transparent line-by-line CBA audit trail
16. Restriction toggle (Offseason/In-season/Deadline) with real dates
17. Community feed / votes / comments / sharing
18. Data-currency honesty (flag unconfirmed) like SalarySwish

## Appendix C — Critic's raw missing-items list

- SIMULTANEOUS vs NON-SIMULTANEOUS TRADE is barely mentioned (one cell in Section 2) but never modeled as the structural fork it is. The entire matching-bracket table the audit cites (200%+250K / +7.5M / 125%+250K) applies ONLY to a SIMULTANEOUS trade. A NON-simultaneous trade matches differently: takeback = outgoing + $250K (apron padding) or +$100K, with NO 200%/125% expansion, and it GENERATES a TPE for the unused room. The engine's single maxIncomingSalary() conflates these. There is no field/flag for trade method, no rule for when a trade MUST be non-simultaneous (e.g. when a TPE is used, or when generating a TPE), and no spec for the resulting TPE amount. This is a P0 correctness hole the audit did not name.
- TPE GENERATION MATH is listed as a feature but the audit never specifies the formula or the simultaneous-vs-non-simultaneous split that drives it. TPE created = (outgoing salary of the player whose slot generates it) - (incoming matched against that slot), and a team can only generate a TPE in a NON-simultaneous (one-out) trade or per-player in a structured deal. No spec for: TPE = outgoing - incoming + $250K? (no — padding is on takeback, not TPE size), one-player-per-TPE absorption rule, the $250K vs $100K padding distinction by apron status, or that a TPE cannot itself be aggregated with other salary. Section 1.3 lists 'amount, created, expiry, used' but no generation algorithm.
- FIRST-APRON TAKEBACK IS WRONG/AMBIGUOUS in the data model. matching.ts returns outgoing * apronTakebackPct for BOTH first_apron and second_apron tiers, and the audit's bracket table says 'apron 100%'. But under the 2023 CBA the 100% hard takeback cap applies to teams OVER the first apron (i.e. between first and second apron AND above second). A team BELOW the first apron but the trade would PUSH it over the first apron still uses the normal brackets but gets hard-capped. The audit never distinguishes 'currently over first apron' (100% match) from 'trade crosses first apron' (normal match + hard cap consequence). The tier-based lookup using preTier silently mis-handles teams that start below and end above.
- AGGREGATION-DEPENDENT MATCHING TIER: The audit's matching table is incomplete because the bracket a team gets ALSO depends on whether it is a taxpayer. Pre-2023 the 'taxpayer' (125%+100K) vs 'non-taxpayer' (200%/150% tiers) distinction governed matching; under 2023 CBA the brackets are keyed to apron status, but the audit never states that a team's matching bracket can change MID-CONSTRUCTION as incoming salary pushes it across the first apron. No spec for iterative/fixed-point evaluation of which bracket applies.
- $ IN TRADES — the audit lists a single 'cash in/out (<=~$7.5M)' field but omits the specifics: the cash limit is a LEAGUE-WIDE per-season amount set annually (was $7.5M, indexed; ~$7.97M for 2025-26), it is SEPARATE for cash sent vs cash received, SECOND-APRON teams cannot send OR receive cash in trades (audit only says 'can't send'), cash cannot be used to acquire a player in the same way as salary for matching, and cash counts toward neither salary matching nor TPE. No season_cash_limit field in Section 1.5 league table.
- MINIMUM-SALARY EXCEPTION as a trade-acquisition path is missing. A team can ALWAYS acquire a player on a minimum-salary contract regardless of cap/apron via the minimum exception, and minimum contracts have special non-aggregation-friendly treatment. The audit lists min-salary SCALE (Section 1.5) for filling roster but never lists the minimum-salary EXCEPTION as a way to absorb an incoming minimum player without matching. Related: the audit omits that two-way and 10-day and minimum deals interact with matching differently.
- OVER-36 / OVER-38 RULE entirely absent. The 'over-38' (formerly over-36) rule reallocates salary in later contract years for players signing multi-year deals at age 35+, changing the CAP HIT per season vs paid salary — directly affecting matching value of those years and tradeability. Not a single mention. Relevant to several tradeable veterans (e.g. LeBron, CP3, Durant-aged deals).
- DESIGNATED-ROOKIE / ROSE RULE / DESIGNATED-VETERAN (SUPERMAX) trade restrictions omitted. (1) A team may have at most TWO designated-rookie-extension players, and CANNOT TRADE FOR a second designated-rookie player (the player becomes ineligible / the deal is blocked) — a hard trade-legality rule. (2) A designated-veteran (supermax) player generally CANNOT BE TRADED for one year after signing the extension. Neither appears anywhere; both are categorical trade blocks Fanspo/Spotrac partially handle.
- SET-OFF and STRETCH details under-specified and slightly wrong-shaped. Audit says stretch = 'remaining x2 + 1' which is the WAIVE-and-stretch formula for the CURRENT-and-future years only; it omits: (a) the stretch provision distinguishes already-earned vs future salary, (b) the 'stretch' on a TRADED dead-money differs, (c) set-off = one-half of the new contract above the one-year minimum, and (d) the 15% rule limiting how much stretched dead money can sit on the cap in any year (the 'no more than 15% of cap in stretched salary' aggregate test). These cascade into team-salary computation.
- WAIVER / CLEARING mechanics for trade legality missing. A traded player's salary counts for the ACQUIRING team's matching immediately, but waiver claims, the 48-hour trade-call window, and the rule that you cannot waive-and-re-sign to circumvent matching are not modeled. Also missing: a player acquired in trade cannot be the SAME player traded back to the original team within one year (anti-circumvention), and the rule that a waived player cannot be re-acquired by the waiving team for a period.
- SIGN-AND-TRADE BYC and 3-YEAR-MINIMUM specifics incomplete. Audit names 'S&T BYC' and '3-yr min' but omits: (1) the receiving team in an S&T is HARD-CAPPED at the first apron for the season (named) BUT also the OUTGOING base-year-comp on an S&T is computed as the AVERAGE of the new salary, making the outgoing match value asymmetric — audit's BYC row covers re-signs but not the S&T-specific outgoing/incoming dual value where the SENDING team uses 50% and the RECEIVING team uses full incoming. (2) A team OVER the FIRST apron (not just second) cannot ACQUIRE via sign-and-trade. (3) S&T contract must be 3-4 years with only year 1 fully guaranteed. (4) The signing team cannot use S&T if it would exceed the apron.
- REPEATER TAX and TAX-BRACKET specifics: audit flags '$ calc' as missing but never lists the actual 2023-CBA escalated bracket multipliers (1.5/1.75/2.5/3.25/3.75 and +0.5 per $5M step above) NOR the NEW repeater definition (taxpayer in 3 of prior 4 years) NOR the harsher 2025-26 repeater rates. No season-scoped tax_brackets table shape is given (just 'bracket table'). The audit also omits that tax is computed on TEAM SALARY at SEASON END, not at trade time, which affects what 'tax bill' a trade tool can even claim.
- BASE-YEAR COMPENSATION trigger conditions under-specified. BYC applies to a re-signed player ONLY when: team is OVER THE CAP using Bird/Early-Bird, AND the raise is >20% (actually: new salary > prior salary AND new salary > the minimum), AND it is within the BYC window. The audit's BYC row says '>20% raise at/over cap -> out = greater(50%, prior)' but omits that BYC no longer applies to most trades under the 2023 CBA EXCEPT in sign-and-trade scenarios — i.e. straight-up in-season BYC was largely eliminated and now BYC essentially only matters for S&T. The audit treats BYC as a general live rule, risking modeling a rule that mostly doesn't fire.
- ROSTER-MINIMUM-AFTER-TRADE specifics: audit says 'can't drop <14 >2wks' but omits the hard rule that a team must have AT LEAST the players to field a trade (you cannot trade away players you don't have post-deal), the 14-player minimum (with 2-week grace) AND the rule that you cannot make a trade that leaves you UNABLE to meet the minimum, plus the playoff-roster and two-way-activation-limit (50 games / 90 days) constraints. Also missing: the maximum 15 standard + 3 two-way = 18, and that incoming players over 15 force a corresponding waive which must itself be cap-legal.
- DRAFT-PICK 'SEVEN-YEARS-OUT' window and STEPIEN are named but the audit omits: (1) the Stepien rule applies to FIRST-round picks only and bans being WITHOUT a first in consecutive FUTURE years (you may trade this year's and keep next year's), and the 'frozen pick' for second-apron teams is a SEPARATE rule (the pick 7 years out gets frozen/loses ability to be moved, not Stepien). (2) Second-round picks have NO Stepien limit and can be traded much further out — the audit's pick model doesn't distinguish round-specific rules well. (3) Pick PROTECTION rollover-to-second-round conversion and 'pick can only be protected for a finite window then must convey' (the forced-conveyance rule) need a structured shape the audit calls 'jsonb prose' without defining the protection schema (top-N, year-range, conveyance order, swap-direction, rollover-to-2nd).
- DEAD-MONEY / WAIVED-PLAYER salary in TEAM SALARY computation is mentioned for display but not as an INPUT to matching/apron. Dead money from previously-waived players counts toward team salary (and thus apron/tax tiers) but is NOT a tradeable asset and cannot be matched against — the team-salary derivation in Phase 2 must include dead money, and the audit's team-salary formula (contracts + holds + exceptions + min-roster) OMITS dead money / waived-player cap charges entirely.
- INCOMPLETE-ROSTER CHARGES formula missing. For under-cap teams, each open roster slot below 12 (not 14) incurs a roster charge equal to the rookie minimum, added to team salary for cap-space computation. The audit mentions 'min-roster/incomplete-roster charge' as a line item but gives no number (12-slot threshold, rookie-min amount) and no source beyond 'CBA'.
- EXHIBIT 10 detail: audit lists Exhibit-10 bonus but omits the mechanics that make it trade-relevant: an Exhibit-10 can CONVERT to a two-way, the bonus ($5K-$77.5K range) is only earned on certain conditions, and crucially Exhibit-10 and non-guaranteed training-camp deals are NOT tradeable until a date. Two-way contracts: audit says 'not tradeable, convert first' — actually two-ways CAN be traded but with restrictions; the audit's blanket 'not tradeable' is an oversimplification worth flagging.
- TRADE BONUS (kicker) interaction with matching is under-specified: audit says kicker 'adds to incoming for matching' and 'voids at max' but omits: (1) the kicker is paid by the ORIGINAL team but the CAP HIT moves with the player, (2) the kicker is allocated PRO-RATA across remaining guaranteed years (changing per-year cap hits), (3) for the OUTGOING team the kicker is NOT part of outgoing matching salary, only the receiving side, and (4) a kicker that would push a player over the MAX is automatically reduced — the audit notes the max-void but not the pro-rata reallocation that changes which season's cap hit changes.
- FANSPO-VISIBLE DATA POINTS the audit forgot: (a) player HEADSHOT images and team logos on the trade card (Fanspo renders player photos — needs a headshot URL field/source, NBA CDN), (b) player JERSEY NUMBER, (c) contract TOTAL VALUE and AVERAGE ANNUAL VALUE display, (d) 'salary by season' mini-table per player as shown in Fanspo cards, (e) the trade's net salary change per team and 'new payroll' headline number, (f) Fanspo's TRADE GRADE letter and community APPROVE/REJECT percentage bar, (g) player COLLEGE/experience label, (h) the 'this trade works/doesn't work' binary badge per team. Several are display-only but require fields not in the data model (headshot_url, jersey_number, contract aggregate values).
- CURRENCY / FRESHNESS at the CONTRACT level: audit has a transactions log and data_version but no per-row updated_at / verified_at / confidence on contracts and draft_picks. To beat SalarySwish's honesty flag you need a per-field 'last_verified' and 'is_estimated' on the contract and pick rows, not just a global data_version. The manual-override table is mentioned but its SCHEMA (which fields it can override, precedence rules, audit trail) is never specified.
- OPTION-DECISION CASCADE: audit lists 'option decision date' but omits that a DECLINED option or a player/team option year affects whether that year's salary is 'on the books' for FUTURE-DATED trade sims and for cap projections, and that an ETO (early termination option) and a player option behave differently for cap-hold generation when they hit free agency. The forward cap-sheet feature (Rank 1) depends on per-year option RESOLUTION logic that isn't specified.
- NO-TRADE-CLAUSE breadth: audit treats NTC as a tiny hardcoded set (LeBron) but omits the IMPLICIT one-year veto: a player who re-signed with Bird rights on a one-year deal (or one-year + option) gets an automatic right to veto a trade (loses Bird rights if traded). The audit's 1.1 'implied/1-yr NTC' row exists but is marked just P1/derived with no enforcement rule; this should be P0 because it categorically blocks aggregation/trade without consent and Fanspo gets it wrong — a stated differentiator.
- THIRD-APRON / FUTURE-CBA hooks: the prompt explicitly asked to consider 'third-apron talk' — the audit never addresses forward-compatibility of the apron model (the tier system is hardcoded to two aprons; the season_cap table has fixed first_apron/second_apron columns rather than a flexible apron_lines structure). If the league adds tiers or changes thresholds the schema can't represent it. A normalized apron_thresholds(season, level, amount) shape is the missing future-proof design.
- VALIDATION SEVERITY MODEL missing: the audit's engine returns binary valid/invalid errors, but a Fanspo-beating tool needs WARNINGS vs HARD-BLOCKS vs INFO (e.g. 'legal but triggers repeater tax', 'legal but hard-caps you', 'requires player consent', 'requires both teams under apron'). The TradeError type has only 'code/message'; no severity, no per-team consent-required state, no 'conditionally legal pending date' state. This blocks the 'why it fails + exact fix' white-space feature the audit itself prioritizes.
