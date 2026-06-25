'use client';
import { useRouter } from 'next/navigation';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';

// "Open in editor" for a saved/shared trade. Seeds the store from the saved payload, then routes
// home. Because the store persists synchronously, the edited board is in localStorage before the
// board mounts and rehydrates - so it loads the right trade with no race against rehydration.
export function EditTradeButton({
  season,
  teams,
  assets,
  simulatedDate,
  tradeMethod,
}: {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate?: string;
  tradeMethod?: TradeMethod;
}) {
  const router = useRouter();

  function edit() {
    useTradeStore.setState({
      season,
      teams,
      assets,
      simulatedDate,
      tradeMethod: tradeMethod ?? 'simultaneous',
      compareIds: [],
    });
    router.push('/');
  }

  return (
    <button
      onClick={edit}
      className="inline-block rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
    >
      Open in editor →
    </button>
  );
}
