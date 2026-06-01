'use client';

export function ExecuteTradeButton({ valid, onExecute }: { valid: boolean; onExecute: () => void }) {
  return (
    <button
      onClick={onExecute}
      disabled={!valid}
      className={`w-full rounded-lg py-3 font-display text-base font-bold uppercase tracking-[0.12em] transition ${
        valid
          ? 'bg-[var(--accent)] text-black shadow-[0_0_30px_-6px_var(--accent)] hover:brightness-110'
          : 'cursor-not-allowed bg-[var(--surface-2)] text-[var(--faint)]'
      }`}
    >
      Execute Trade
    </button>
  );
}
