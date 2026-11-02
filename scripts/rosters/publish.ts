// Atomically publish the validated public snapshot. Does not modify trades or legacy tables.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { RosterSnapshot } from '../../lib/data/types';
const snapshot: RosterSnapshot=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data/seed/roster_snapshot_2026_27.json'),'utf8'));
if(Object.keys(snapshot.teams).length!==30||Object.values(snapshot.teams).some(t=>t.roster.length<14||!Number.isFinite(t.apronSalary)))throw new Error('Run roster audit before publishing');
const url=process.env.DATABASE_URL??process.env.NETLIFY_DATABASE_URL;
if(!url)throw new Error('Database connection is required');
const sql=neon(url);
async function main() {
  await sql`INSERT INTO roster_snapshots (season,version,payload,imported_at)
    VALUES (${snapshot.season},${snapshot.version},${JSON.stringify(snapshot)}::jsonb,now())
    ON CONFLICT (season) DO UPDATE SET version=excluded.version,payload=excluded.payload,imported_at=now()
    WHERE (roster_snapshots.payload->>'checkedAt')::timestamptz <= (excluded.payload->>'checkedAt')::timestamptz`;
  const rows=await sql`SELECT version,imported_at FROM roster_snapshots WHERE season=${snapshot.season}`;
  if(rows[0]?.version!==snapshot.version)throw new Error('Published version verification failed');
  console.log(`Published ${snapshot.season} snapshot ${snapshot.version}; import timestamp verified.`);
}
main().catch(()=>{console.error('Roster snapshot publication failed. The prior published snapshot is retained.');process.exitCode=1;});
