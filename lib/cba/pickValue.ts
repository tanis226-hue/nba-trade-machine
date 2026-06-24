// Rough trade value of a draft pick, expressed in the same per-game "Game Score" units used for
// player value so picks and players are comparable in the grade. A first ≈ a rotation player; a
// second ≈ a deep-bench flier. Distant picks are discounted modestly (more uncertainty, later help).
// Transparent and tunable; refine with a real pick-value curve + projected standings later.
export function pickValue(round: number, year?: number, currentYear = 2026): number {
  const base = round === 1 ? 8 : 2;
  const out = year ? Math.max(0, year - currentYear) : 0;
  const decay = Math.max(0.6, 1 - out * 0.05);
  return Math.round(base * decay * 10) / 10;
}
