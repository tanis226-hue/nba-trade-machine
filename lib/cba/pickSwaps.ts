/**
 * Pure draft-pick SWAP RESOLVER. Linked picks can carry swap rights: an owner receives the
 * "most favorable" (best = lowest pick number), "least favorable" (worst = highest number), or
 * an Nth-favorable pick among two or more teams' slots. Lower slot number is more favorable
 * (slot 1 is the best pick). Ties resolve deterministically: the first-listed slot wins.
 * 2023 CBA Art. VII §7 — pick swaps.
 */

export type SwapKind = 'most_favorable' | 'least_favorable' | 'nth_favorable';

export interface SwapSlot {
  team: string;
  slot: number; // draft position; 1 = best
}

export interface SwapInput {
  kind: SwapKind;
  nth?: number; // 1-based rank for 'nth_favorable' (1 = most favorable, ascending)
  slots: SwapSlot[];
}

export interface SwapResult {
  team: string;
  slot: number;
  reason: string;
}

/**
 * Resolve which slot an owner with swap rights receives. 'most_favorable' takes the min slot,
 * 'least_favorable' the max slot, 'nth_favorable' the Nth slot ascending (1-based). Ties keep
 * the first-listed slot (stable). Throws on empty slots or an out-of-range nth.
 */
export function resolveSwap(input: SwapInput): SwapResult {
  const { kind, slots } = input;
  if (slots.length === 0) throw new Error('resolveSwap: no slots provided');

  // Sort by slot ascending, breaking ties by original index so the first-listed wins.
  const indexed = slots.map((s, i) => ({ ...s, i }));
  const ascending = [...indexed].sort((a, b) => a.slot - b.slot || a.i - b.i);

  if (kind === 'most_favorable') {
    const w = ascending[0]!;
    return { team: w.team, slot: w.slot, reason: `most favorable of ${labelOf(slots)} → ${w.team} #${w.slot}` };
  }

  if (kind === 'least_favorable') {
    // Worst (highest) slot; on a tie the first-listed wins, so sort by slot desc then original index asc.
    const w = [...indexed].sort((a, b) => b.slot - a.slot || a.i - b.i)[0]!;
    return { team: w.team, slot: w.slot, reason: `least favorable of ${labelOf(slots)} → ${w.team} #${w.slot}` };
  }

  const n = input.nth ?? 1;
  if (n < 1 || n > ascending.length) {
    throw new Error(`resolveSwap: nth=${n} out of range for ${ascending.length} slots`);
  }
  const w = ascending[n - 1]!;
  return { team: w.team, slot: w.slot, reason: `${ordinal(n)}-most favorable of ${labelOf(slots)} → ${w.team} #${w.slot}` };
}

export interface ParsedNote {
  kind: SwapKind;
  nth?: number;
}

/**
 * Interpret a free-text swap note. Returns null for notes that are not swaps (e.g. protections
 * like "top-4"). Recognized forms (team lists like "IND/WAS" are ignored, only the swap kind and
 * rank are read):
 *   "most favorable"            → most_favorable
 *   "least favorable" / "less favorable of A/B" → least_favorable
 *   "2nd-most favorable"        → nth_favorable, nth=2
 */
export function parseSwapNote(note: string): ParsedNote | null {
  const s = note.toLowerCase();
  if (!s.includes('favorable')) return null;

  // Nth-most favorable: "2nd-most favorable", "3rd most favorable", "second most favorable".
  const nth = parseNth(s);
  if (nth != null && nth >= 2) return { kind: 'nth_favorable', nth };

  // "less/least favorable" → worst; "more/most favorable" → best. "less favorable of A/B" = max.
  if (/\b(least|less|worse|worst|lower|lowest)\b/.test(s)) return { kind: 'least_favorable' };
  if (/\b(most|more|better|best|higher|highest)\b/.test(s)) return { kind: 'most_favorable' };

  return null;
}

function parseNth(s: string): number | null {
  const digit = /(\d+)(?:st|nd|rd|th)?[-\s]*(?:most|least|favorable)/.exec(s);
  if (digit) return Number(digit[1]);
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  for (const [word, n] of Object.entries(words)) {
    if (new RegExp(`\\b${word}[-\\s]*(?:most|least|favorable)`).test(s)) return n;
  }
  return null;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

function labelOf(slots: SwapSlot[]): string {
  return slots.map((s) => `${s.team} #${s.slot}`).join('/');
}
