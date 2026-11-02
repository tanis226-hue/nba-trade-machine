'use client';
import { useTradeStore } from '@/lib/store/tradeStore';
import { useRouter } from 'next/navigation';

export function SeasonSelector({ seasons }: { seasons: string[] }) {
  const router=useRouter();
  const season = useTradeStore((s) => s.season);
  const setSeason = useTradeStore((s) => s.setSeason);
  return (
    <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
      Roster year
      <select
        value={season}
        onChange={(e) => {
          const state=useTradeStore.getState();
          if(state.teams.length && !confirm('Changing roster year starts a new board. Continue?'))return;
          setSeason(e.target.value);
          router.push(`/?season=${e.target.value}`);
        }}
        className="num rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs tracking-normal text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
