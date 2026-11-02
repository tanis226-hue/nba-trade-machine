import { cache } from 'react';
import bundled from '@/data/seed/roster_snapshot_2026_27.json';
import type { RosterSnapshot } from './types';
import { db,hasDb } from './db';

export type LoadedRosterSnapshot=RosterSnapshot&{loadedFrom:'database'|'bundled';importedAt?:string};
export function bundledRosterSnapshot(season:string):RosterSnapshot|null {
  return season==='2026-27'?bundled as unknown as RosterSnapshot:null;
}
/** One immutable, atomically published dataset per season, memoized for each server render. */
export const getRosterSnapshot=cache(async(season:string):Promise<LoadedRosterSnapshot|null>=>{
  const local=bundledRosterSnapshot(season);
  if(hasDb()) {
    try {
      const rows=await db()`SELECT payload,imported_at FROM roster_snapshots WHERE season=${season}`;
      const payload=rows[0]?.payload as RosterSnapshot|undefined;
      if(payload?.season===season&&Object.keys(payload.teams??{}).length===30&&(!local||payload.version===local.version||payload.checkedAt>=local.checkedAt)) {
        return {...payload,loadedFrom:'database',importedAt:String(rows[0].imported_at)};
      }
    } catch { /* A not-yet-migrated or unavailable database uses the versioned snapshot. */ }
  }
  return local?{...local,loadedFrom:'bundled'}:null;
});
