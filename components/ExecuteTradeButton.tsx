'use client';

export function ExecuteTradeButton({ valid, onExecute }: { valid: boolean; onExecute: () => void }) {
  return (
    <button
      onClick={onExecute}
      disabled={!valid}
      className={`w-full rounded-lg py-3 font-bold text-white transition ${
        valid ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-neutral-400'
      }`}
    >
      Execute Trade
    </button>
  );
}
