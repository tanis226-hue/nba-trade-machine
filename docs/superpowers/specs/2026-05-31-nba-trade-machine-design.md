# NBA Trade Machine — Design Spec

**Date:** 2026-05-31 (rev 2)
**Status:** Approved for planning
**Owner:** David Tanis (ZLDA)

## 1. Goal

A fast, mobile-responsive, multi-team NBA trade machine that supports 2–6 teams,
draft-pick assets, and **accurate, current** CBA apron / luxury-tax validation, with
persistent share links and ad-optimized layouts. The product's edge over Fanspo and
Spotrac is **correctness + currency + clean fast UI**: current-cap-year salaries
(including just-activated extensions), exact first/second-apron rule application, and
all the data a user needs to reason about a deal on one screen. This spec covers the
full product; v1 is the first shippable milestone (Phasing, §9).

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Next.js (App Router) + TypeScript + Tailwind + Supabase Postgres, deploy on Vercel | One codebase, lowest latency, fewest moving parts |
| CBA engine | Pure TS module, runs **client-side** for live feedback; reused server-side for share pages | Beats per-keystroke API on latency (<150ms) and reuses code |
| Roster/contract data | **Hybrid: scheduled scraper (full contracts from a comprehensive public source) + hand-maintained override JSON** | Beats competitor staleness; override layer fixes brand-new extensions/edge cases immediately |
| Season awareness | Data keyed by season; UI has a **cap-year selector**; the active extension's salary is selected per chosen year | Fixes the "Holmgren $13M vs $41M" failure mode directly |
| v1 scope | Current data + correct CBA engine + 2–4 team data-rich UI + share links | Power-user-grade and accurate from day one |
| Styling | Tailwind CSS; a dedicated clean-design pass via the frontend-design skill | Fast, distinctive, not generic-AI |
| Trade state | Zustand store; validation as memoized derived state | Instant recompute on every asset move |

## 3. Competitive requirements (derived from Fanspo / Spotrac gaps)

These are hard requirements, each mapped to a phase.

| Competitor failure | Our requirement | Phase |
|---|---|---|
| Fanspo: stale salaries, missing active extensions (Holmgren $13M→$41M) | Current-cap-year data via scrape+override; salary chosen per selected season | 1 |
| Fanspo: bypasses apron rules; applies 2nd-apron rules to 1st-apron-only teams | Engine applies the **exact** tier's rules; 1st vs 2nd apron strictly distinguished; no bypass | 2 |
| Fanspo: can't renounce cap holds on dump trades into cap space; rejects legal deals | Model cap room + cap holds; below-cap absorption path; renounce-holds support | 7 |
| Spotrac: clunky, slow, sluggish UI | Fast, clean, responsive UI; instant client-side validation | 3, 5 |
| Spotrac: screenshot/share truncates multi-team deals | Share image + page render **all** teams in a deal, never truncated | 4 |
| Spotrac: no future-date planning; blocks deals that become legal later | **Future-date projection mode**: simulate a target date, surface "illegal now, legal on <date>" with the reason | 6 |
| Spotrac/Fanspo: phantom apron/hard-cap flags on under-cap teams | Hard caps applied **only** when an apron-triggering tool is actually used; never phantom-flag | 2 |

## 4. Architecture

```
Next.js app (Vercel)
├── app/                     routes: /, /trade/[slug], /api/trade, OG image route
├── components/              TradeMatrix, TeamColumn, PlayerCard, TeamCapPanel,
│                            AssetRow, ValidationFeed, SeasonSelector, AdSlot
├── lib/
│   ├── cba/                 PURE engine (no React/DB) — §6
│   ├── store/               Zustand trade store + derived validation selector
│   └── data/                typed Supabase access + season-aware queries
├── data/
│   └── overrides/           hand-maintained correction JSON (extensions, edge cases)
├── scripts/
│   ├── scraper/             Python: pull rosters+contracts -> normalized JSON
│   └── import.ts            merge scraped JSON + overrides -> upsert Supabase
├── .github/workflows/       scheduled scrape+import (cron)
└── supabase/migrations/     SQL schema
```

The `lib/cba/` engine has **zero dependencies on React, Next, or Supabase** so it runs
in the browser, in an API route, and in unit tests unchanged. Data ingestion is a
separate Python scraper that normalizes to JSON; `import.ts` overlays the override
file and upserts. A scheduled GitHub Action keeps data current.

## 5. Data model (Supabase Postgres)

Designed so the user sees **everything needed to judge a deal** and the engine has
everything needed to judge legality.

- **teams** — `id, name, abbr, conference, logo_url, primary_color, secondary_color`
- **players** — `id, name, position, team_id, age, years_of_service`
- **contracts** — `id, player_id, season, salary, option_type` (`team|player|eto|guaranteed|non_guaranteed|two_way`), `guarantee_status` (`full|partial|non_guaranteed`), `partial_guarantee_amount`, `no_trade_clause boolean`, `source` (`scrape|override`)
  - one row per player-season → multi-year contracts are multiple rows
- **trade_restrictions** — `id, player_id, kind` (`recently_signed|recently_extended|base_year_comp|poison_pill|sign_and_trade`), `eligible_date`, `cannot_aggregate_until`, `note` — powers trade-eligibility dates / future-date projection
- **season_cap** — `season, salary_cap, tax_line, first_apron, second_apron, min_team_salary`
- **team_exceptions** — `id, team_id, season, kind` (`tpe|mle|bae|room`), `amount`, `expires_date` — TPEs and exceptions available to absorb salary
- **cap_holds** — `id, team_id, season, label, amount, renounceable boolean` — for below-cap room math
- **draft_picks** — `id, owning_team_id, original_team_id, season, round, protections (jsonb), is_swap, is_frozen`
- **trades** — `id, slug, payload (jsonb snapshot incl. season), created_at`

Seed/refresh: Python scraper → normalized JSON; `import.ts` overlays `data/overrides/*`
and upserts (idempotent). `trades` is the only table written at app runtime.

## 6. CBA engine (`lib/cba/`) — verified rules

Core IP. Small, independently testable, pure modules. **Rules below are sourced
(see §11) and encoded as data in `constants.ts`; logic is tested with clean fixture
numbers so correctness is independent of the dollar figures.**

### 6.1 Verified rule set (2023 CBA, 2025-26 figures)
- **2025-26 landmarks:** cap $154,647,000 · tax $187,895,000 · first apron $195,945,000 · second apron $207,824,000 · min team salary $139,182,000.
- **Salary matching, team below first apron (3 tiers by outgoing salary):**
  - ≤ $7,500,000 → take back **200% + $250,000**
  - $7,500,001–$29,000,000 → take back **outgoing + $7,500,000**
  - > $29,000,000 → take back **125% + $250,000**
- **Team over the first apron (incl. second apron):** take-back limited to **100%** of outgoing (the 110% transitional rule expired after 2023-24).
- **First apron restrictions:** no sign-and-trade acquisition; no BAE; no non-taxpayer MLE; can't sign a regular-season-waived player whose pre-waive salary exceeded the non-taxpayer MLE; can't use a prior-year TPE; 100% matching cap.
- **Second apron restrictions (all first-apron rules plus):** **cannot aggregate two or more players' salaries in a trade**; no cash sent in trades; no S&T player used for matching; no TPE generated by a sign-and-trade; first-round pick 7 years out becomes frozen if over the 2nd apron at season's end.
- **Hard cap:** applied only when a team actually uses a first/second-apron-triggering tool; otherwise none (no phantom flags).

### 6.2 Modules
- `types.ts` — shared engine types (tiers, brackets, trade input/output).
- `constants.ts` — the §6.1 numbers and rule tables, each with a citation comment and a per-season VERIFY note.
- `tier.ts` — `tierFor(salary, seasonCap)` → `below_cap | over_cap | over_tax | first_apron | second_apron`.
- `matching.ts` — `maxIncomingSalary(outgoing, tier, rules)`; 3-tier below-apron, 100% at/above apron.
- `apron.ts` — `restrictionsFor(tier, rules)` → `{ canAggregate, maxTakebackPct, blockedTools[] }`.
- `validateTrade.ts` — orchestrator: per team computes outgoing/incoming/post-salary and pre/post tier; runs matching + aggregation + hard-cap checks; returns structured, human-readable errors (e.g., *"Heat are above the second apron and cannot aggregate salaries."*).

Heavy TDD suite: exact-match swaps, all 3 matching tiers, 100% apron cap, second-apron aggregation block, picks-don't-count, multi-team (3–4) flows, and "no phantom hard cap" cases.

## 7. Frontend (clean + data-rich)

- **State:** Zustand `{ season, teams, assets, assignments }`; memoized selector runs `validateTrade` on every change.
- **SeasonSelector** — pick the cap year being simulated; salaries/landmarks update accordingly.
- **TradeMatrix** — horizontal columns, one `TeamColumn` per team (2–6; v1 caps at 4); mobile → swipeable carousel.
- **TeamColumn → TeamCapPanel** — team total salary, **distance-to-tax/apron meters** (progress bars), current tier badge, roster count, available TPEs/exceptions; updates live with the deal.
- **PlayerCard** — name, age, position, current-year salary, **full year-by-year contract**, option type (player/team/ETO), guarantee status, no-trade flag, and a trade-eligibility indicator (eligible date if restricted). This is the "all the data they need" surface.
- **AssetRow** — route a player/pick to a destination team (checkbox/select; drag-and-drop later).
- **ValidationFeed** — per-team salary deltas, tier badges, and descriptive `Trade Denied:` errors, live.
- **Share** — `GenerateLinkButton` POSTs state → `/trade/[slug]`; share page + OG image render **all** teams (no truncation).
- **AdSlot** — reserved `min-height` boxes (320x50, 728x90, 300x600, 300x250); placeholders in v1, real network later, always `async/defer`, never CLS.
- **Design pass:** team-colored accents, compact cards, clear hierarchy; executed via the frontend-design skill in Phase 3/5 so it isn't generic.

## 8. Non-functional requirements

- Validation feels instant (client-side; effectively zero network).
- Ad scripts `async/defer`, never block app/calc scripts; all ad containers have hardcoded `min-height`.
- Mobile-first; carousel on small screens; sticky footer ad preserved.
- Data freshness: scheduled scrape+import; override file gives same-day corrections.

## 9. Phasing

| Phase | Deliverable | v1? |
|---|---|---|
| 0 | Scaffold: Next.js+TS+Tailwind, Supabase, lint/test, git | ✅ |
| 1 | Data pipeline: schema + Python scraper + override merge + scheduled import + season-aware queries | ✅ |
| 2 | CBA engine (TDD, verified rules): tier → matching (3-tier) → apron (100% + aggregation) → validateTrade | ✅ |
| 3 | Trade UI: multi-team matrix (2–4), data-rich PlayerCard + TeamCapPanel + SeasonSelector, live validation; clean-design pass | ✅ |
| 4 | Sharing: persist trade → slug → share page + multi-team OG image (no truncation) | ✅ |
| 5 | Monetization + polish: ad-network wiring, 1.5s interstitial, carousel/clean-UI refinement | later |
| 6 | Trade-eligibility dates + **future-date projection** (illegal-now/legal-on-date) | later |
| 7 | Cap room + cap holds (renounce on dump trades), TPE usage in matching, 5–6 teams, pick-protection UI | later |

**v1 = Phases 0–4.** Picks are movable assets in v1; protection editing is Phase 7.

## 10. Out of scope (v1)

User accounts/auth, real ad revenue wiring, future-date projection, cap-hold renouncing,
TPE-as-absorption math, draft-pick protection editing UI, teams 5–6, drag-and-drop
(checkbox/select routing first).

## 11. Sources & items to verify during implementation

- **2025-26 figures (official):** [NBA.com](https://www.nba.com/news/nba-salary-cap-set-2025-26-season), [Hoops Rumors](https://www.hoopsrumors.com/2025/06/salary-cap-tax-line-set-for-2025-26-nba-season.html).
- **Salary-matching brackets:** [Hoops Rumors](https://www.hoopsrumors.com/2023/09/salary-matching-rules-for-trades-during-2023-24-season.html), [Sports Business Classroom](https://sportsbusinessclassroom.com/understanding-trade-matching-in-the-new-collective-bargaining-agreement/).
- **Apron restrictions (1st/2nd):** [Hoops Rumors glossary](https://www.hoopsrumors.com/2025/01/hoops-rumors-glossary-tax-aprons-2.html).
- **First-apron 100% take-back (110% expired after 2023-24):** confirmed via SBC/Hoops Rumors.
- **Verify each cap year:** the bracket thresholds ($7.5M, $29M) and apron dollar figures change per season — re-confirm before each season's data refresh and encode in `constants.ts` with citations.
- **Scraper source + ToS:** confirm the chosen public source's terms; keep the override file authoritative on conflicts.
