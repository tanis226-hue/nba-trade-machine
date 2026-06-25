import type { PickProtection } from './types';

// Resolve whether a protected draft pick actually conveys given the owner's projected draft slot.
// Pure: no DB/network/fs. The slot is 1-based (1 = best lottery odds / worst record).
// A 'top' protection through N protects slots 1..N (does NOT convey); slots > N convey.
// A 'range' protection conveys only when the slot falls inside [a,b] inclusive; otherwise protected.
// Null or 'unprotected' always conveys regardless of slot.

export type ConveyanceOutcome =
  | 'conveys'
  | 'unprotected_conveys'
  | 'protected_rolls'
  | 'converts_to_seconds';

export interface ConveyanceResult {
  conveys: boolean;
  outcome: ConveyanceOutcome;
  reason: string;
}

export interface ConveyanceYear {
  year: number;
  protection: PickProtection | null;
  projectedSlot: number;
}

export interface ConveyanceScheduleResult {
  conveysInYear: number | null;
  finalOutcome: ConveyanceOutcome;
  reason: string;
}

export function resolveConveyance(protection: PickProtection | null, projectedSlot: number): ConveyanceResult {
  if (protection == null || protection.type === 'unprotected') {
    return { conveys: true, outcome: 'unprotected_conveys', reason: 'Unprotected: conveys at any slot.' };
  }

  if (protection.type === 'top') {
    const through = protection.through ?? 0;
    if (projectedSlot <= through) {
      return {
        conveys: false,
        outcome: 'protected_rolls',
        reason: `Slot ${projectedSlot} is within top-${through} protection: does not convey.`,
      };
    }
    return {
      conveys: true,
      outcome: 'conveys',
      reason: `Slot ${projectedSlot} falls outside top-${through} protection: conveys.`,
    };
  }

  if (protection.type === 'range') {
    const [a, b] = protection.range ?? [0, 0];
    if (projectedSlot >= a && projectedSlot <= b) {
      return {
        conveys: true,
        outcome: 'conveys',
        reason: `Slot ${projectedSlot} is within range ${a}-${b}: conveys.`,
      };
    }
    return {
      conveys: false,
      outcome: 'protected_rolls',
      reason: `Slot ${projectedSlot} is outside range ${a}-${b}: does not convey.`,
    };
  }

  // No structured protection type (swap/favorable note-only): treat as conveying, nothing protects it.
  return { conveys: true, outcome: 'conveys', reason: 'No structured protection: conveys.' };
}

export function resolveConveyanceSchedule(years: ConveyanceYear[]): ConveyanceScheduleResult {
  if (years.length === 0) {
    return { conveysInYear: null, finalOutcome: 'protected_rolls', reason: 'No protection years supplied.' };
  }

  for (const { year, protection, projectedSlot } of years) {
    const r = resolveConveyance(protection, projectedSlot);
    if (r.conveys) {
      return {
        conveysInYear: year,
        finalOutcome: r.outcome,
        reason: `Conveys in ${year}: ${r.reason}`,
      };
    }
  }

  const last = years[years.length - 1];
  if (last.protection?.rolloverToSecond) {
    return {
      conveysInYear: null,
      finalOutcome: 'converts_to_seconds',
      reason: `Never unprotected through ${last.year}: converts to second-rounder(s).`,
    };
  }

  return {
    conveysInYear: null,
    finalOutcome: 'protected_rolls',
    reason: `Protected every year through ${last.year}: obligation extinguishes (no conveyance).`,
  };
}
