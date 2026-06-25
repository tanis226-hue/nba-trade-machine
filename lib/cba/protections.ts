import type { PickProtection } from './types';

// Turn researched protection prose (stored as a freeform `note`) into the structured PickProtection
// the engine reads. Pick protections are researched as short strings - "top-4", "31-55",
// "most favorable", "unprotected" - so this is the bridge from human notes to machine-readable
// conveyance data. Anything it can't classify (swap/favorable language) is preserved as note-only,
// never guessed, so a future conveyance resolver can lean on `type`/`through`/`range` with confidence.

// A second-round rollover: explicit "then/to ... 2nd(s)/second". "(else to OKC)" is a conveyance to
// another team, not a rollover, so it must NOT match.
const ROLLOVER = /\b(?:then|to|becomes?|converts?\s+to)\b[^)]*\b(?:2nd|2nds|second)\b/i;
const TOP = /\btop-?\s*(\d+)/i;
const RANGE = /^\s*(\d+)\s*-\s*(\d+)/;

export function parseProtectionNote(note: string): PickProtection {
  const raw = note.trim();
  const result: PickProtection = { note: raw };
  if (!raw) return result;

  if (/^unprotected\b/i.test(raw)) {
    result.type = 'unprotected';
    return result;
  }

  const top = raw.match(TOP);
  if (top) {
    result.type = 'top';
    result.through = Number(top[1]);
    if (ROLLOVER.test(raw)) result.rolloverToSecond = true;
    return result;
  }

  const range = raw.match(RANGE);
  if (range) {
    result.type = 'range';
    result.range = [Number(range[1]), Number(range[2])];
    return result;
  }

  // Swap / favorable language is not a top/range protection - leave it as note-only.
  return result;
}

// Normalize the raw value stored on a draft pick (jsonb `{note}`, a bare string, or an
// already-structured object) into a PickProtection, or null when there is no protection.
export function parseProtection(raw: unknown): PickProtection | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() ? parseProtectionNote(raw) : null;
  if (typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  const note = typeof obj.note === 'string' ? obj.note.trim() : '';
  const result: PickProtection = note ? parseProtectionNote(note) : {};

  // Respect any structured fields the source already carries (future-proofing for richer data).
  if (obj.type === 'top' || obj.type === 'range' || obj.type === 'unprotected') result.type = obj.type;
  if (typeof obj.through === 'number') result.through = obj.through;
  if (Array.isArray(obj.years) && obj.years.length === 2) result.years = [Number(obj.years[0]), Number(obj.years[1])];
  if (Array.isArray(obj.range) && obj.range.length === 2) result.range = [Number(obj.range[0]), Number(obj.range[1])];
  if (typeof obj.rolloverToSecond === 'boolean') result.rolloverToSecond = obj.rolloverToSecond;
  if (note) result.note = note;

  return Object.keys(result).length ? result : null;
}
