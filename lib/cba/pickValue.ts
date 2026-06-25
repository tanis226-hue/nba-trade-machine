import type { PickProtection } from '@/lib/cba/types';

// Draft-pick value model (0..100). A tanking team's unprotected pick should score far above a
// contender's protected one. Assumptions, all tunable:
//  - Base value follows draft slot on a smooth, monotonically decreasing curve (slot 1 best, 60 worst).
//    The curve is steep early (the #1 vs #5 gap dwarfs the #25 vs #30 gap) and flattens late, which is
//    why we use an exponential decay rather than a straight line.
//  - With no projected slot we infer an expected slot from the owner's win% (worse team => earlier pick),
//    mapping a 0.500-ish team to the lottery edge and the league's worst to the very top.
//  - With neither slot nor win%, fall back to the round midpoint (slot 15 for firsts, 45 for seconds).
//  - Round 2 is a small fraction of round 1: even the best second is bench-flier territory.
//  - Protection discounts the RECEIVER, who may never get the pick. Top-N scales with N (more outcomes
//    keep the pick with the sender). A narrow range conveyance discounts by how little of the draft can
//    convey. Unprotected: no discount.
//  - Picks further out add uncertainty, so apply a mild per-year decay.

export interface PickValueInput {
  round: 1 | 2;
  projectedSlot?: number; // 1..60
  ownerWinPct?: number; // 0..1; lower => better expected pick
  protection?: PickProtection | null;
  yearsOut?: number; // drafts into the future; 0 = this year's draft
}

const FIRST_SLOTS = 30;
const TOTAL_SLOTS = 60;
const ROUND2_FRACTION = 0.12; // a top second ≈ a low first's small fraction
const SLOT_DECAY = 0.055; // controls early steepness of the base curve
const YEARS_OUT_DECAY = 0.04; // per-year uncertainty discount
const MAX_YEARS_DISCOUNT = 0.4; // never discount distance more than this

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// A worse team (low win%) projects to an earlier (better) slot. 0.000 → slot 1, ~0.600 → end of
// lottery, 0.820+ → bottom of round 1. Linear in win% across the first round, then flat into round 2.
function slotFromWinPct(winPct: number): number {
  const w = clamp(winPct, 0, 1);
  const slot = 1 + (w / 0.82) * (FIRST_SLOTS - 1);
  return clamp(slot, 1, TOTAL_SLOTS);
}

// Smooth, monotonically decreasing base curve over slots 1..60, normalized to 0..100 at slot 1.
function baseFromSlot(slot: number): number {
  const s = clamp(slot, 1, TOTAL_SLOTS);
  const top = Math.exp(-SLOT_DECAY * (1 - 1));
  const floor = Math.exp(-SLOT_DECAY * (TOTAL_SLOTS - 1));
  const here = Math.exp(-SLOT_DECAY * (s - 1));
  return (100 * (here - floor)) / (top - floor);
}

function resolveSlot(input: PickValueInput): number {
  if (typeof input.projectedSlot === 'number') return clamp(input.projectedSlot, 1, TOTAL_SLOTS);
  if (typeof input.ownerWinPct === 'number') {
    const slot = slotFromWinPct(input.ownerWinPct);
    return input.round === 2 ? slot + FIRST_SLOTS : slot;
  }
  return input.round === 2 ? 45 : 15; // round midpoint fallback
}

// Receiver-side discount: a protected pick may never convey. Returns a multiplier in (0, 1].
export function protectionMultiplier(p: PickProtection | null | undefined): number {
  if (!p || p.type === 'unprotected' || (!p.type && p.through == null && !p.range)) return 1;

  if (p.type === 'top' || (p.through != null && p.range == null)) {
    const n = clamp(p.through ?? 1, 1, TOTAL_SLOTS);
    // Bigger top-N => more outcomes keep the pick with the sender => bigger discount.
    // top-1 ≈ negligible, top-30 (whole first round) approaches a coin flip on conveyance.
    const disc = clamp(n / FIRST_SLOTS, 0, 1) * 0.55;
    return 1 - disc;
  }

  if (p.type === 'range' && p.range) {
    const [lo, hi] = p.range;
    const width = clamp(hi - lo + 1, 1, TOTAL_SLOTS);
    // A narrow conveyance window is unlikely to land => bigger discount; a wide one is nearly certain.
    const disc = clamp(1 - width / TOTAL_SLOTS, 0, 1) * 0.5;
    return 1 - disc;
  }

  return 1;
}

function yearsOutMultiplier(yearsOut: number | undefined): number {
  const y = Math.max(0, yearsOut ?? 0);
  return 1 - Math.min(MAX_YEARS_DISCOUNT, y * YEARS_OUT_DECAY);
}

function scoreFromInput(input: PickValueInput): number {
  const slot = resolveSlot(input);
  let v = baseFromSlot(slot);
  if (input.round === 2) v *= ROUND2_FRACTION;
  v *= protectionMultiplier(input.protection);
  v *= yearsOutMultiplier(input.yearsOut);
  return Math.round(clamp(v, 0, 100) * 10) / 10;
}

// Legacy positional signature used by grade.ts: pickValue(round, year?, currentYear?) returning
// per-game Game Score units. Preserved unchanged so the existing grader keeps its calibrated scale.
function legacyPickValue(round: number, year?: number, currentYear = 2026): number {
  const base = round === 1 ? 8 : 2;
  const out = year ? Math.max(0, year - currentYear) : 0;
  const decay = Math.max(0.6, 1 - out * 0.05);
  return Math.round(base * decay * 10) / 10;
}

export function pickValue(input: PickValueInput): number;
export function pickValue(round: number, year?: number, currentYear?: number): number;
export function pickValue(
  a: PickValueInput | number,
  year?: number,
  currentYear = 2026,
): number {
  if (typeof a === 'number') return legacyPickValue(a, year, currentYear);
  return scoreFromInput(a);
}
