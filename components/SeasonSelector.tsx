'use client';
import {useState} from 'react';
import {ConfirmDialog} from './ConfirmDialog';
import { useTradeStore } from '@/lib/store/tradeStore';
import { useRouter } from 'next/navigation';

export function SeasonSelector({ seasons }: { seasons: string[] }) {
  const router=useRouter();
  const season = useTradeStore((s) => s.season);
  const setSeason = useTradeStore((s) => s.setSeason);
  const [pending,setPending]=useState<string|null>(null);
  function change(next:string){setSeason(next);router.push(`/?season=${next}`);setPending(null);}
  return (
    <>
    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
      Roster year
      <select
        value={season}
        onChange={(e) => {
          const next=e.target.value;
          if(useTradeStore.getState().teams.length)setPending(next);else change(next);
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
    {pending&&<ConfirmDialog title={`Switch to ${pending}?`} description="Changing roster year starts a new board with that season’s players and rules. Save a link first if you want to return to this proposal." action="Change roster year" onCancel={()=>setPending(null)} onConfirm={()=>change(pending)}/>}
    </>
  );
}
