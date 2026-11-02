import { createHash } from 'node:crypto';
import { db,hasDb } from '@/lib/data/db';
import { RequestError } from './request';

const local=new Map<string,{hits:number;reset:number}>();
export async function limitWrite(req:Request,action:string,limit=20) {
  // Netlify replaces this header at the edge. Never trust arbitrary X-Forwarded-For.
  const ip=process.env.NETLIFY==='true'?req.headers.get('x-nf-client-connection-ip'):null;
  const key=createHash('sha256').update(`${action}:${ip??'local'}`).digest('hex');
  if(hasDb()) {
    const rows=await db()`INSERT INTO public_write_limits (key,hits,reset_at)
      VALUES (${key},1,now()+interval '15 minutes')
      ON CONFLICT (key) DO UPDATE SET
        hits=CASE WHEN public_write_limits.reset_at<=now() THEN 1 ELSE public_write_limits.hits+1 END,
        reset_at=CASE WHEN public_write_limits.reset_at<=now() THEN now()+interval '15 minutes' ELSE public_write_limits.reset_at END
      RETURNING hits`;
    if(Number(rows[0]?.hits)>limit) throw new RequestError(429,'Too many requests. Try again in 15 minutes.');
    return;
  }
  if(process.env.NETLIFY==='true') throw new RequestError(503,'Sharing is temporarily unavailable. Your board is saved in this browser.');
  const now=Date.now(); const bucket=local.get(key);
  const next=bucket&&bucket.reset>now?{...bucket,hits:bucket.hits+1}:{hits:1,reset:now+900_000};
  local.set(key,next);
  if(next.hits>limit) throw new RequestError(429,'Too many requests. Try again in 15 minutes.');
}
