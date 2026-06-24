# NBA Trade Machine: Beat-Fanspo Plan + Build (2026-06-24)

**Method:** 13-agent research workflow (current-code audit of engine/data/UI + web research on Fanspo
features, verified Fanspo user complaints, competitor landscape, unmet-demand wishlist, data-currency
strategy, drag/compare UX patterns) + adversarial verification of the top complaints. Companion: the
2026-06-23 information-requirements audit (`2026-06-23-fanspo-beating-info-audit.md`).

This doc is the strategy + roadmap. The synthesized research is reproduced in full below; the
**Implementation (this branch)** section at the end records what is being built now.

---

## 1. Honest completion assessment

Owner's gut "~50%" is close. Grounded, area-by-area:

| Area | Grounded | Why |
|---|---|---|
| CBA Engine | **55-65%** | Matching / apron / aggregation / hard-cap / cash / pick / eligibility skeleton is real, pure, 100+ tests. Missing: BYC (re-signed players match at full salary), poison-pill (typed but unconsumed), kicker cap-charge, over-38, designated-player, stretch. The apron `blockedTools` arrays are **declarative only** - first-apron MLE/BAE/TPE and most second-apron tool bans are listed but never enforced. Engine looks more complete than it validates. |
| Data + Sources | **45-55%** | 3 primary entities populated (contracts 1,192 / players ~520 / picks 384) + value/bio/headshots. But the advanced-CBA schema (migration 0002) is migrated with **zero rows and zero readers**: `team_exceptions`/TPE, `cap_holds`, `trade_restrictions` empty + never queried. `getRoster` reads 5 of ~20 contract columns (kickers, NTCs, Bird, signed_via all NULL). ~17-20% value/bio **slug-orphan** rate (`p_a_j_lawson` vs `p_aj_lawson`) -> ~100 players grade as 0. Refresh 100% manual, `data_version` unused. Schema ceiling high, populated reality low. |
| UI / Features | **70-75%** of build/validate/share core; **~40%** of full Fanspo surface | Trade-building, validation feed, cap panels, forward cap sheet, grade, share+community, dark mode, team pages are real and polished. Gaps are the owner-named ones: no FA signing, no RFA/offer-sheet, no S&T flow, no player comparison, no protection/swap editing, no future-year editing, mouse-only DnD, no-op Finalize. |

**Net ~55-60%.** Highest-leverage truth: **wiring existing-but-empty data into the existing-but-starved
engine is cheaper and higher-impact than building anything new.**

## 2. What customers actually want (ranked by verified demand)

1. **CBA accuracy that enforces the second apron** (strongest, multi-source verified). Fanspo's #1 verified failure: it grades illegal trades legal, notably letting second-apron teams aggregate ("Fanspo's is more accurate, but you can still aggregate outgoing contracts, which means it is broken" - Bright Side of the Sun, VERIFIED). **We already enforce `NO_AGGREGATION` - this is our wedge.**
2. **One tool that unifies legality + analysis.** Market is split (ESPN = record, no CBA; Spotrac/Fanspo/SalarySwish = cap-accurate, no analysis). **We have `grade.ts`; nobody cap-accurate does.**
3. **Sign-and-trade, cap holds, FA signing inside the trade flow.** App Store "Can't Sign-And-Trade"; Fanspo markets "Sign Free Agents." Owner-named; we have none in UI.
4. **"Make this trade legal" auto-fixer.** No NBA tool offers it. **We have `autofix.ts` text - near-shipped.**
5. **Fairness/value grade with contract surplus + pick valuation.** **We have `grade.ts`+`pickValue.ts` (curve crude).**
6. **Fit/needs + projected record impact.** Expensive (roster-construction + projection model).
7. **Protection-aware future pick ownership + conveyance odds.** "Hardest part to program." White space (TankOdds-style not in any trade machine). Our picks are real but protections are free-text prose.
8. **Smooth card rearranging + mobile (touch) UX.** Owner-named. Our DnD is mouse-only HTML5.
9. **Player comparison + side-by-side stats in the deal.** Owner-named. Fanspo only as a separate page.
10. **Data freshness / honesty.** Fanspo lags in offseason (VERIFIED). Nobody flags confidence / "last verified."
11. **One-tap shareable branded graphics + community feed.** We have share links + comments/votes, no OG image.

## 3. Parity gaps vs Fanspo (owner-named in bold)

| Feature | Fanspo | Us now | Gap |
|---|---|---|---|
| **Card rearranging** | DnD + dropdown, full-screen, mobile-friendly | Native HTML5 DnD, mouse-only, route-buttons primary | No touch, no animated reorder, no drop indicator, cross-group no-op. Need `@dnd-kit` + tap-to-move. |
| **Pick/swap info + rules** | Set protections, picks first-class | Chips w/ `*`/`⇄`/`❄` + tooltips; Stepien+7yr | Protections free-text `{note}`, `isSwap` ignored by `picksRule`, no view/edit, no conveyance. |
| **Sign free agents** | Button -> terms -> payroll | None | Whole flow missing (list, cap-hold, exception-aware signing). |
| **Sign/match RFAs** | RFA status, QO symbol (no explicit offer-sheet) | None; columns exist unpopulated | No RFA designation, QO, offer-sheet, match. **Fanspo's own weak spot - beat opportunity.** |
| **Player comparison + stats** | Deep `/compare-players` | Per-card GS+PTS/REB/AST; 4-stat modal | No side-by-side; shallow stats; ~20% players 0-value (slug bug). |
| Cap holds / dead cap | Per-team display | `computeTeamSalary` accepts them, never wired (0) | No data, no display, no renounce. |
| TPE / exceptions | Per-team TPEs as assets | Engine consumes `TeamException[]`, table empty + unqueried | Dead at runtime. Populate + query + picker. |
| Multi-year payroll | 5-season tables w/ Signed-Using | `CapSheet.tsx` forward years | No per-year tier labels, Signed-Using, guarantee, future-year edit. |
| Contract modification | Waive/stretch/extend | Current-season salary edit only | No waive/stretch/extend. |
| Max teams | 2-5 | 2-5 | **Parity.** |
| Community | Feed, vote, comment, explain | Votes+comments on share page | No global feed, no dedupe/auth. |

## 4. Where we BEAT Fanspo (cheap = rides existing engine/data)

1. **CBA-cited, second-apron-correct audit trail (cheap, flagship).** Make `NO_AGGREGATION` + per-finding citations loud: a live "tripwire" panel naming which action hard-capped a team and which asset froze. Close the declarative-only gap (enforce `blockedTools`) so we don't fall into Fanspo's trap.
2. **Auto-fixer "make this trade legal" (cheap).** Make `autofix.ts` one-click and mutate the deal.
3. **Fairness + fit grade with surplus (cheap now, medium for fit).** Ship grade next to a *legal* deal.
4. **Date-aware legality tied to NBA calendar (cheap).** Extend `eligibility.ts` to deadline gating.
5. **Pick valuation + conveyance odds (medium-expensive).** TankOdds-style, needs machine-readable protections.
6. **Data-honesty stamp (cheap, trust moat).** "Data as of <ts>" + per-datum confidence badges.
7. Sequential/dependent multi-step trades (expensive, later).
8. **Dark mode (already shipped; Fanspo has none).**

## 5. Data-currency plan

**Per-domain sources:** base salaries = Basketball-Reference scrape (residential IP, <=20 req/min, ToS-risky -> cross-check) or balldontlie GOAT ($40/mo, cloud-friendly, shallow); value/bio/headshots/rookies = stats.nba.com (residential proxy + TLS fingerprint, no contracts); picks+protections = manual web research -> `scripts/picks/build.ts`; kickers/NTCs/Bird/TPE/cap-holds = **human curation** into the override layer (no programmatic source exists); transactions = HoopsRumors/RealGM as event triggers; cap landmarks = NBA reporting (lock ~Jul 1).

**Architecture (keep):** balldontlie/BBRef base layer -> residential-proxy stats enrichment -> manual CBA-truth override layer. Merge precedence `data/seed < scripts/scraper/out < data/overrides`, `try/catch -> local` so an unmigrated column never 500s.

**Cadence tied to calendar:** Jun 29 option/QO deadline; Jun 30-Jul 6 moratorium surge = hourly; Feb deadline week = hourly; in-season daily; otherwise weekly; lock cap landmarks at league-year flip.

**Honesty mechanism:** populate the dormant `data_version` table with per-domain `updated_at`, write it at the end of `import.ts`, render a "Data as of" footer + per-datum confidence badges on protections/kickers/NTCs. Converts our weakness into a trust advantage Fanspo lacks.

## 6. Prioritized roadmap

**NOW (make what we built work):** N1 fix value/bio slug-orphan (~100 players 0-value); N2 wire `cap_holds`/TPE/`deadMoney` into `TradeBoard.add()`; N3 enforce declarative `blockedTools`; N4 one-click auto-fixer that mutates; N5 loud second-apron tripwire panel; N6 data-honesty stamp; N7 verify 2026-27 cap (~$165M) vs `// PROJECTED`; N8 vote dedupe.

**NEXT (owner-named parity + mobile):** X1 `@dnd-kit` + tap-to-move; X2 player comparison view; X3 machine-readable pick protections + swap linkage; X4 sign-free-agents flow; X5 sign-and-trade UI; X6 real Finalize/save; X7 per-trade OG image; X8 base-year compensation in engine.

**LATER (new data/models):** L1 RFA offer-sheet+match; L2 conveyance odds (Monte-Carlo); L3 fit/needs+projected impact; L4 automated refresh worker; L5 community feed; L6 sequential multi-step trades; L7 waive/stretch/extend.

## 7. Open questions for the owner

1. **Paid data budget?** balldontlie GOAT ($40/mo) + residential proxy (Webshare, low) unblock automation; Sportradar ($10k+/mo) overkill. (gates L4)
2. **Manual curation owner + cadence** for kickers/NTCs/Bird/TPE (no programmatic source; also gates BYC/X8).
3. **Community scope + accounts** - stay no-login (an advantage) or build accounts + global feed?
4. **Native app vs PWA** - Fanspo's native app is unshipped; a polished PWA could beat them.
5. **Player-value metric** - keep free Game Score or license LEBRON/EPM for grade/fit credibility?
6. **Pick-protection ambition** - commit the X3 restructure now to unlock L2 conveyance odds?
7. **Launch bar** - recommend launching after NOW + X1/X2 (cheap differentiators already beating Fanspo on accuracy/auto-fix/grade/honesty) rather than waiting on FA/RFA/conveyance.

---

## Implementation (this branch)

Per the owner directive to build it out, this branch ships the owner-named NEXT items plus the
cheapest highest-impact NOW fix, in priority order:

- **X1 - dnd-kit drag-and-drop** (`@dnd-kit/core|sortable|utilities|modifiers`): replace native HTML5
  DnD with a single `DndContext` over the board, `SortableContext` per team column, `DragOverlay`
  for a smooth floating preview, pointer + touch + keyboard sensors (touch + WCAG 2.5.7 path), and a
  drop indicator. Route-buttons retained as the explicit non-drag path.
- **X2 - player comparison**: `compareIds` in the store + `⊕ vs` button per card + a `PlayerCompare`
  tray/modal with a side-by-side stat table (salary, GS, PTS/REB/AST, position/bio, multi-year).
- **X4 - sign free agents (UFA, with RFA flagging)**: `getFreeAgents(season, priorSeason)` derives the
  pool (players with a prior-season contract but none this season; 151 in the seed), a per-team
  "Sign FA" panel with search + salary input + UFA/RFA toggle, and `signFreeAgent` that adds a
  tradeable roster card and bumps the team's cap/apron payroll (reversed on remove/reprice).
- **Picks/swaps info**: surface protection prose (`{note}`) + swap/frozen markers on pick cards.
- **N1 - slug-orphan fix**: normalize player-id slugs so value/bio joins stop zeroing ~100 players.

Engine-internal NOW items (N2/N3/N5 wiring, BYC) and LATER items remain roadmapped, not yet built.
