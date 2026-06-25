This is a pure analysis/synthesis task. The gap map is fully provided, so I'll produce the prioritized implementation plan directly without needing to read the codebase (the gap map already cites exact files/rule-modules).

# NBA Trade Engine: CBA Ruleset Implementation Plan

## What the engine already gets right

The core matching skeleton is solid: three below-apron expanded-matching brackets, first-apron 100% ceiling, second-apron no-aggregation + 100% + no-S&T-acquisition + no-cash-send, min-salary $0-incoming asymmetry, S&T first-apron hard cap, roster 15-max, cash send/receive limits, NTC consent (explicit + implied 1-yr Bird), 7-year pick window, and a Stepien consecutive-gap scan. Eligibility freezes (recently-signed, agg-lock, ext-freeze, no-trade-back) and the tax/floor info layers exist. The architecture (pure `(ctx) => TradeFinding[]` rules, additive except `matchingRule` legalization) is the right shape to extend.

---

## P0 gaps (correctness) — silent approval of illegal trades or mis-valuation

Ordered by blast radius (how common the affected trade is x how wrong the verdict is).

### 1. Hard-cap line is never populated upstream
- **Mechanic:** A hard cap (CBA Art. VII) is absolute: once triggered, team salary may not exceed that apron for any reason for the rest of the cap year. Triggers: NTMLE, BAE, BAE, S&T acquisition, Expanded TPE use (first apron); Taxpayer MLE, Aggregated TPE, cash-out, S&T-generated TPE (second apron).
- **Current state:** `rules/hardCap.ts` HARD_CAP_EXCEEDED *enforces* a `hardCapLine`, but `addTeam`/`buildContext` default it to `null`. Only the transient S&T-acquisition path sets a ceiling. **Every other hard-cap trigger silently passes.**
- **Add:** A `deriveHardCap(ctx)` step (new `lib/cba/hardCap.ts` derivation, consumed before rules run) that sets `team.hardCapLine = min(existing, firstApron | secondApron)` based on (a) `blockedTools`/tool-usage inputs and (b) engine-derived triggers (expanded-TPE band >100%, aggregation, cash-out). Data: a `toolsUsed: ToolUsage[]` field on the team input (NTMLE/BAE/TMLE/Room/prior-year-TPE flags) plus deriving the in-trade triggers from the matching result.
- **Impact:** This is the keystone. Without it the engine approves trades that vault a team over an apron it is contractually frozen below. Fixes ~8 separate P0/P1 trigger rows at once.

### 2. Base-Year Compensation (BYC) — entirely absent
- **Mechanic:** In an S&T where the signing team is at/above the cap and re-signs its own FA via Bird/Early-Bird with a raise >20% above the prior salary, the **sender's outgoing match value = max(50% of new first-year salary, prior-season salary)** while the **acquirer's incoming = full new first-year salary**. Asymmetric.
- **Current state:** No BYC anywhere. `matchValue` returns a single symmetric figure, so the sender's matching uses the full new salary — understating their outgoing, which can make an illegal S&T appear legal (sender can't actually absorb the takeback) or vice versa.
- **Add:** A BYC path in `lib/cba/matching.ts`: per-player `outgoingMatch` vs `incomingMatch`. Gate inside S&T legalization. Data: per-player `signedVia`, `birdRights`, `priorSalary`, `signingTeamOverCap` flags. New `lib/cba/rules/byc.ts` or fold into matching.
- **Impact:** Every cap-team S&T of an own-FA is mis-valued today. This is a headline trade type (star re-sign-and-flip), so user-visible wrongness is high.

### 3. Second-apron cash ban is too broad (blocks receive)
- **Mechanic:** A second-apron team may **not SEND** cash in a trade; **receiving cash is allowed**.
- **Current state:** `rules/secondApronExtras.ts` SECOND_APRON_CASH blocks when the apron team is sender **OR** receiver of cash.
- **Add:** Tighten the predicate to send-only (direction of the cash asset relative to the apron team). One-line-ish fix in `secondApronExtras.ts`.
- **Impact:** Engine currently *rejects legal trades*. Lower stakes than a false-approve but a visible false-negative on common second-apron deals.

### 4. Post-trade roster legality missing the two-way ≤3 leg
- **Mechanic:** Post-trade a team may hold ≤3 two-way contracts (and the receiver needs an open two-way slot).
- **Current state:** `rules/roster.ts` enforces 15-max (block) and 14-min (warning) but excludes two-ways entirely with no cap on them.
- **Add:** A TWO_WAY_OVER block in `roster.ts` using a two-way count delta (current two-way count + incoming two-ways - outgoing two-ways > 3).
- **Impact:** Approves trades that leave an illegal two-way roster. Narrower than salary bugs but a clean correctness miss.

### 5. Ted Stepien — possibility test + swap crediting
- **Mechanic:** No outcome may leave a team without a first-rounder in two consecutive future drafts. Test is over the **possibility tree** of protections/swaps, not a static conveyance. Owning another team's first **or an unprotected swap** satisfies a year.
- **Current state:** `rules/picks.ts stepienViolation` scans for consecutive gaps but uses a static `conveyed` boolean and **ignores `isSwap`** (swaps not credited as a retained selection) and **ignores `protections`** (no rule reads `PickProtection` at all).
- **Add:** Make `stepienViolation` resolve protections into best/worst-case conveyance and credit swaps as a held selection. Data already typed (`protections`, `isSwap`, `originalTeam`) — needs a consumer in `picks.ts`.
- **Impact:** Both false-positives (un-credited swaps flagged) and false-negatives (protected picks that *could* convey both years not flagged). Pick-heavy deals are common; verdict is load-bearing.

> Note: the **trade-deadline calendar gate** (P1 below) borders on P0 — when `simulatedDate` is set past the deadline the engine still approves trades — but it only misfires under explicit date simulation, so it sits at the top of P1.

---

## P1 gaps (parity)

- **TPE inventory + lifetime (Standard/non-sim).** `matching.ts` emits a `TPE_GENERATED` info but never writes `generatedTpe` to the TeamResult, enforces no single-outgoing-player constraint, and has no 12-month expiry. Needs a per-team TPE inventory (creation date, amount, sim/non-sim, S&T-origin) wired from import. Unlocks TPE consumption, expiry, hard-cap-on-use, and no-combine. (Ties to "TPE balances still needed" in AGENTS.md.)
- **Bracket-2 add-on constant.** Tier-2 below-apron uses flat `OTS+$7.5M`; should be the escalating `~$8.527M` figure. One-constant fix in `MATCHING_2026_27.belowApron`. Verify tier-1 break ($7.25M vs $7.5M) too.
- **Trade-deadline gate.** `calendar.tradeDeadline` exists but no rule consumes it; add a block (or hard warning) in `eligibility.ts` when `simulatedDate > tradeDeadline`.
- **Poison pill (rookie-scale extension) dual-value.** `isRookieScaleExtension` typed but unconsumed. Outgoing = current pre-extension salary; incoming = avg annual over all remaining (current + extension years). Add asymmetric path in `matching.ts` keyed on extension signed/effective dates.
- **Hard-cap triggers from tools (NTMLE, BAE, Expanded-TPE).** Consumers for the `blockedTools` array — feeds rule #1's derivation. `blockedTools` is declarative-only today.
- **Designated Veteran (supermax) 1-year trade lock** and **matched-RFA 1-year restriction.** Add date-driven freezes in `eligibility.ts` parallel to EXT_FREEZE.
- **Trade kicker correctness.** `matchValue` adds `tradeBonusPct` but `maxSalary` is often unpopulated (so the bonus is added uncapped) and the kicker is not applied to apron/tax/hard-cap salary. Populate `maxSalary`; apply kicker to cap figures. (Kicker data behind Cloudflare per AGENTS.md.)
- **Room TPE $250K cushion + no-combine.** Cap-room absorption is missing the room cushion and the "cannot combine with another exception" constraint.
- **Dead-money ingestion verify.** `computeTeamSalary` trusts the source feed; confirm waived/stretched dead money is included or apron/tier positions understate.
- **S&T length max (4yr) + options-excluded.** ST_SHORT_TERM checks the 3-yr min only; add the 4-yr max excluding option years.
- **Stepien 7-year off-by-one** and **PICK_TOO_FAR off-by-one** flagged VERIFY — confirm against "7th draft after the trade."

---

## P2 (edge)

- Second-apron **frozen pick** derivation (7-years-out trigger, slide-to-30th, unfreeze) — `priorSecondApronSeasons` plumbed but unconsumed; needs multi-season apron history.
- **Pick protections resolver**: rollover / forced conveyance / second-round conversion (`rolloverToSecond` unread); deferral option; conditional-conveyance cap of two.
- **Over-38 rule** detection + pro-rata reallocation (affects `matchValue` for aging vets).
- **Min-contract stacking limit** (3+ aggregation, fewer incoming, outside Dec15-deadline window).
- **Dec-16 re-aggregation carve-out** on AGG_LOCK; **2-month agg-lock** Dec-16 deadline exception.
- **30-day locks** (drafted rookie / new two-way / waiver claim); **two-way 30-day lock + open-slot**.
- **July moratorium** gate; **post-deadline/playoff blackout**.
- **DPE** (no-TPE-generation flag, deadlines); **MLE/BAE/Room values** as cap-percentage constants (only needed for hard-cap consequence + tool availability).
- **S&T edge eligibility**: own-FA-on-roster provenance, Bird/Early/Non-Bird signing-rights requirement, year-1 guarantee, TMLE-used bar, RFA offer-sheet preclusion, second-apron-sender no-takeback.
- **Repeater-taxpayer derivation** (3-of-prior-4) instead of consumed flag; **waive-and-stretch** formula + 15%-of-cap limit + set-off (team-salary accuracy, not trade legality).
- **Renegotiation** freezes/limits (largely out of trade-validation core).

---

## Quick wins (cheap because engine/data is already close)

1. **Second-apron cash send-only fix** (P0 #3) — predicate tightening in `secondApronExtras.ts`. Hours.
2. **Two-way ≤3 block** (P0 #4) — `roster.ts` already computes the standard delta and filters `isTwoWay`; add a parallel two-way count + block. Hours.
3. **Bracket-2 add-on constant** (P1) — single constant in `MATCHING_2026_27.belowApron`; verify tier-1 break. Minutes + a fixture.
4. **Trade-deadline gate** (P1) — `calendar.tradeDeadline` already on context; add one date comparison in `eligibility.ts`. Hours.
5. **`blockedTools` → hard-cap derivation** (rule #1 + P1 triggers) — the array, the `hardCapLine` field, and the *enforcing* HARD_CAP_EXCEEDED rule all already exist; what's missing is the `deriveHardCap` consumer that writes the line. Wiring, not new machinery. This is the single highest-leverage quick-ish win: it activates NTMLE/BAE/Expanded-TPE/cash/aggregation hard caps in one step.
6. **Stepien swap crediting** (P0 #5, partial) — counting `isSwap` as a held selection is a small change to the existing `stepienViolation` loop; the full protection-possibility tree is the larger follow-on.
7. **TPE inventory wiring** (P1) — the *consumption* path in `matching.ts` (single incoming ≤ TPE amount) already exists and is dead only because the inventory is never populated; populating it from import + setting `generatedTpe` activates a whole domain without writing new matching logic.

Recommended first sprint: quick wins 1-5 (correctness false-positive/negative cleanup + the hard-cap keystone), then P0 #2 (BYC) and P0 #5 (Stepien possibility tree) as the two genuinely new computation paths.
---

## Implemented this session (engine build-out)

**Quick wins / P0 correctness (all firing):**
- Second-apron cash is now SEND-only (was wrongly blocking receive). `secondApronExtras.ts`.
- S&T contract length: added the 4-year MAX (`ST_LONG_TERM`); 3-yr min already existed. `signAndTrade.ts`.
- Two-way ≤3 roster cap (`TWO_WAY_OVER`) + `twoWayCount` input. `roster.ts`.
- Trade-deadline freeze (`TRADE_DEADLINE`), conservative in-season window so offseason deals never trip it. `eligibility.ts`.
- Hard-cap derivation (`deriveHardCap` in `engine.ts`): an over-the-cap team that takes back MORE than it sends (expanded traded-player exception) is hard-capped at the first apron - this FIRES from trade data via the existing `HARD_CAP_EXCEEDED` rule. Also derives first/second-apron hard caps from `toolsUsed`.
- Apron tool blocks (`TOOL_BLOCKED`, new `tools.ts`): consumes the previously-declarative `blockedTools` arrays + a `toolsUsed` team input.
- Stepien swap crediting (`picks.ts`): trading a SWAP no longer counts as losing your first; holding a swap counts as a held selection.
- Base-Year Compensation (`engine.ts` + `matching.ts`): a `isBaseYearComp` player's OUTGOING match value = max(50% new, prior) while incoming stays full; `outgoingMatch` separated from cap-basis `outgoing`.
- TPE inventory wired end-to-end: `team_exceptions` query + override + import + migration 0008, attached to teams, auto-consumed by `matchingRule`, displayed per team. Curated OKC's $9.2M Wiggins TPE.

**Still roadmapped (P1/P2, mostly dormant pending data or edge cases):** poison-pill dual-value, kicker applied to apron/tax, designated-vet 1-yr & matched-RFA locks, room-TPE cushion, frozen-pick derivation from apron history, full pick-protection possibility tree, over-38, min-contract stacking, moratorium gate, repeater derivation, waive-and-stretch. Engine logic for `toolsUsed`/BYC/two-way is in place and fires once the UI/data supplies those inputs.

## Round 2 (remaining P1/P2 now implemented)

- **Poison-pill dual-value** (`matching.ts`): an acquired rookie-scale-extension player matches at the AVERAGE annual value of the new deal (current + extension years); the sending team still matches at the current cap hit.
- **Trade kicker → apron** (`hardCap.ts`): the kicker now adds to the acquiring team's apron salary (incoming only), not just the matching value.
- **Designated-veteran 1-year no-trade** + **matched-RFA 1-year (consent) restriction** + **over-38 note** (`eligibility.ts`).
- **July moratorium gate** (`eligibility.ts`): conditional "agreed now, official on <date>" during the late-June/early-July window.
- **Frozen-pick derivation** (`picks.ts`): a recent second-apron team (`priorSecondApronSeasons`) trading its first 7 drafts out is blocked, even without an explicit `isFrozen` flag.
- **Repeater-tax derivation** (`engine.ts`): repeater status derived from `priorTaxpayerSeasons >= 3` (taxpayer in 3 of the prior 4).
- **TPE expiry + one-player-per-TPE** (`matching.ts`): an expired TPE (vs the trade date) can't absorb; each TPE takes one player.
- **Waive-and-stretch + set-off** (`stretch.ts`): 2x(years)+1 spread, 15%-of-cap stretch limit, half-above-minimum set-off.

**Genuinely remaining (edge / data-blocked / unverified):** bracket-2 add-on dollar constant (needs the official 2026-27 figure), room-exception $250K cushion, min-contract 3+ stacking carve-out, the full pick-protection possibility tree (current Stepien is swap-aware + worst-case), and the Disabled Player Exception. Test coverage: 137 passing across 25 files.
