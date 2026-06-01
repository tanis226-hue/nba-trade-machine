'use client';
import { useTradeStore } from '@/lib/store/tradeStore';

export function SeasonSelector({ seasons }: { seasons: string[] }) {
  const season = useTradeStore((s) => s.season);
  const setSeason = useTradeStore((s) => s.setSeason);
  return (
    <label className="text-sm text-neutral-700">
      Cap year:{' '}
      <select value={season} onChange={(e) => setSeason(e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
