# NBA Trade Machine — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning
**Owner:** David Tanis (ZLDA)

## 1. Goal

A fast, mobile-responsive, multi-team NBA trade machine that supports 2–6 teams,
draft-pick assets, and instant CBA apron/luxury-tax validation, with persistent
share links and ad-optimized layouts. This spec covers the full product; v1 is the
first shippable milestone (see Phasing).

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Next.js (App Router) + TypeScript + Supabase Postgres, deploy on Vercel | One codebase, lowest latency, fewest moving parts |
| CBA engine | Pure TS module, runs **client-side** for live feedback; same module re-run server-side for OG images | Beats per-keystroke API on latency (<150ms easily) and reuses code |
| Salary data (v1) | Hand-seeded JSON dataset + idempotent import script | De-risks scraping/legal, unblocks the whole app |
| Live data | Standalone Python weekly scraper writing to Supabase | Deferred to Phase 6 |
| v1 scope | Core engine + 2–4 teams + basic share links | Useful to power users fast; defer ads polish, OG, 5–6 teams, pick-protection UI |
| Styling | Tailwind CSS | Speed + responsive utilities for the carousel/ad layout |
| Trade state | Zustand store; validation as memoized derived state | Instant recompute on every asset move |

## 3. Architecture

```
Next.js app (Vercel)
├── app/                     routes: /, /trade/[slug], /api/trade, /api/og/[slug]
├── components/              TradeMatrix, TeamColumn, AssetRow, ValidationFeed,
│                            AddTeamButton, ExecuteTradeButton, AdSlot
├── lib/
│   ├── cba/                 PURE engine (no React, no DB) — see §5
│   ├── store/               Zustand trade store + derived validation selector
│   └── data/                typed Supabase access + query helpers
├── data/                    seed JSON (teams, players, contracts, picks, season_cap)
├── scripts/                 import-seed.ts (idempotent); scraper/ (Phase 6, Python)
└── supabase/migrations/     SQL schema migrations
```

The `lib/cba/` engine has **zero dependencies on React, Next, or Supabase** so it
can run in the browser, in an API route, and in unit tests unchanged.

## 4. Data model (Supabase Postgres)

- **teams** — `id, name, abbr, conference, logo_url, primary_color, secondary_color`
- **players** — `id, name, position, team_id`
- **contracts** — `id, player_id, season, salary, option_type` (`team|player|guaranteed|non_guaranteed|two_way`); one row per season → multi-year is multiple rows
- **season_cap** — `season, salary_cap, tax_line, first_apron, second_apron` (per-season dollar landmarks)
- **draft_picks** — `id, owning_team_id, original_team_id, season, round, protections (jsonb), is_swap`
- **trades** — `id, slug, payload (jsonb snapshot of the full trade state), created_at`

Seed JSON in `/data` is loaded by `scripts/import-seed.ts`, which upserts (safe to
re-run). `trades` is the only table written at runtime (on "Generate Trade Link").

## 5. CBA engine (`lib/cba/`)

The core IP. Four small, independently testable modules.

### 5.1 `constants.ts`
All cap landmarks, salary-matching brackets, and apron rule flags for a given
season. **Every constant carries a source-citation comment and is explicitly
flagged for verification against an authoritative CBA reference (e.g., the CBA
itself / a recognized cap analyst) before ship.** No dollar figure ships
unverified. Structure:

- Season landmarks (cap, tax, first apron, second apron) — sourced from `season_cap`
- Matching brackets (the take-back percentages/bands for teams over the cap)
- Apron restriction flags (aggregation allowed?, max take-back %, hard-cap triggers)

### 5.2 `matching.ts`
`maxIncoming(outgoing, teamTier) → number`. Implements the simultaneous-trade
salary-matching brackets for an over-the-cap team. Below the first apron uses the
generous band; at/above the apron uses the tighter take-back limit. Pure function.

### 5.3 `apron.ts`
`restrictionsFor(teamState) → { canAggregate, maxTakebackPct, hardCapTriggers[] }`.
Encodes the apron consequences:
- **First apron** — hard-cap triggers; limited take-back vs. aggregation
- **Second apron** — cannot aggregate salaries in a trade; tightest take-back; (future: frozen picks, no cash, no TPE-from-prior-year)

### 5.4 `validateTrade.ts`
Orchestrator. Input: full trade state (teams, assets, assignments). For each team:
1. Sum outgoing and incoming salary
2. Compute post-trade team salary and apron tier (pre and post)
3. Run matching check (if over cap)
4. Run apron checks (aggregation, take-back %)
5. Collect structured, human-readable errors

Output: `{ valid: boolean, perTeam: TeamResult[], errors: TradeError[] }` where each
error has a `code`, a `teamAbbr`, and a `message` like
*"Heat are $4.2M over the second apron and cannot aggregate salaries."*

This module gets a thorough TDD unit suite covering: exact-match trades, over-cap
matching bands, first/second apron aggregation blocks, hard-cap triggers, and
multi-team (3–4) flows.

## 6. Frontend

- **State:** Zustand store `{ teams: Team[], assets: Record<id, Asset>, assignments: Record<assetId, destTeamId> }`. A memoized selector runs `validateTrade` on every change.
- **TradeMatrix** — horizontal columns, one `TeamColumn` per team (2–6).
- **TeamColumn** — team's roster + incoming assets; each `AssetRow` (player or pick) has a control to route it to a destination team.
- **AddTeamButton** — scales the matrix 2→6 dynamically (v1 caps at 4).
- **ValidationFeed** — per-team salary deltas, apron tier badges, and the descriptive error list, live.
- **ExecuteTradeButton** — runs validation, shows result; Phase 5 adds the 1.5s processing interstitial.
- **Share** — `GenerateLinkButton` POSTs state to `/api/trade` → returns `/trade/[slug]`; share page renders read-only result + OG image via `/api/og/[slug]`.
- **AdSlot** — reserved `min-height` boxes matching standard sizes (320x50, 728x90, 300x600, 300x250) to prevent CLS; placeholder in v1, real network (AdSense/NitroPay, async/defer) later.
- **Mobile** — team columns collapse into a swipeable carousel; sticky footer ad preserved.

## 7. Non-functional requirements

- Validation feels instant (client-side, target well under 150ms — effectively 0 network).
- Ad scripts load `async`/`defer`, never block app/calc scripts.
- All ad containers have hardcoded `min-height` (no layout shift).
- Mobile-first responsive; carousel on small screens.

## 8. Phasing

| Phase | Deliverable | In v1? |
|---|---|---|
| 0 | Scaffold: Next.js+TS+Tailwind, Supabase, lint/test, git | ✅ |
| 1 | Data: migrations + seed dataset + import script + typed access | ✅ |
| 2 | CBA engine (TDD): constants → matching → apron → validateTrade | ✅ |
| 3 | Trade UI: multi-team matrix (2–4), asset routing, live validation feed | ✅ |
| 4 | Sharing: persist trade → slug → share page + OG image | basic |
| 5 | Monetization + polish: ad slots, mobile carousel, sticky footer, interstitial | later |
| 6 | Python scraper, draft-pick protection UI, 5–6 teams | later |

**v1 = Phases 0–3 + basic share links.** Picks are movable assets in v1; the
interactive protection UI is Phase 6.

## 9. Out of scope (v1)

User accounts/auth, real ad-network revenue wiring, automated live data, draft-pick
protection editing UI, teams 5–6, drag-and-drop (checkbox routing first).

## 10. Open items to verify during implementation

- Exact 2025-26 season cap/tax/apron dollar figures (`season_cap` seed).
- Exact salary-matching bracket percentages and the apron take-back limits — verify
  each against an authoritative source; encode in `constants.ts` with citations.
- Seed dataset source and license for player/contract data.
