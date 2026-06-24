/** Shared money formatter for finding messages. Values are dollars (or test-scale units). */
export function fmt(n: number): string {
  return Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n}`;
}
